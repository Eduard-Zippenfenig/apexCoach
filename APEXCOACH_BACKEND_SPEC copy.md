# ApexCoach — Backend Logic Specification
### For Claude Opus 4.6 · Python / FastAPI · Yas Marina Autonomous Racing Dataset

---

## 0. What You Are Building

You are building the **analysis and coaching engine** for ApexCoach — a motorsport AI coaching product. This backend:

1. **Parses** two MCAP telemetry files (a slow "good lap" and a fast reference lap) recorded at Yas Marina circuit
2. **Aligns** the two laps spatially along the track
3. **Produces live coaching cues** — a per-frame JSON stream comparing the current lap to the reference
4. **Produces post-session coaching** — corner-by-corner time loss analysis + natural language coaching report
5. **Exposes everything as a FastAPI REST + SSE (Server-Sent Events) API** for the frontend to consume

This is **not** a generic analysis library. Every function must be grounded in the actual data shapes described below. All outputs must be structured JSON that a UI can render directly.

---

## 1. Input Files & Data Sources

### 1.1 MCAP Telemetry Files

| Role | File | Duration | Description |
|------|------|----------|-------------|
| Reference / Golden lap | `hackathon_fast_laps.mcap` | 74.3 s | Two fastest laps — use the faster one |
| User / Demo lap | `hackathon_good_lap.mcap` | 81.3 s | Conservative, slower lap |

Both files are ROS 2 MCAP bags. Use the `mcap` Python library to read them.

Install dependencies:
```bash
pip install mcap mcap-ros2-support fastapi uvicorn scipy numpy shapely
```

### 1.2 Primary Topic to Extract

**`/constructor0/state_estimation`** — this is the single most important topic. It publishes at ~100 Hz and contains everything needed for coaching:

| Field | Description | Unit |
|-------|-------------|------|
| `pose.position.x` | X position in local frame | meters |
| `pose.position.y` | Y position in local frame | meters |
| `pose.position.z` | Z position | meters |
| `twist.linear.x` | Forward velocity (vx) | m/s |
| `twist.linear.y` | Lateral velocity (vy) | m/s |
| `additional_state.steering_angle` | Steering wheel angle | radians |
| `additional_state.gas` | Throttle pedal position | 0.0–1.0 |
| `additional_state.brake` | Brake pedal position | 0.0–1.0 |
| `additional_state.gear` | Current gear | integer |
| `additional_state.wheel_speeds` | Four wheel speeds [FL, FR, RL, RR] | rad/s |
| `additional_state.slip_ratios` | Per-wheel slip | dimensionless |
| `additional_state.slip_angles` | Per-wheel slip angles | radians |

**Secondary topics** (extract if primary is unavailable for a field):

| Topic | Key fields | Use for |
|-------|-----------|---------|
| `/constructor0/can/ice_status_02` | `rpm`, `oil_temp`, `water_temp` | RPM / engine state |
| `/constructor0/can/kistler_acc_body` | `ax`, `ay`, `az` | Lateral / longitudinal G |
| `/constructor0/can/kistler_correvit` | `vx`, `vy`, `slip_angle` | Validated ground speed |
| `/constructor0/can/badenia_560_tpms_front` | `pressure_fl`, `temp_fl` | Tyre data |
| `/constructor0/can/wheels_speed_01` | 4 wheel speeds | Wheel speed cross-check |

### 1.3 Track Boundary File

**`yas_marina_bnd.json`** — local XY coordinate frame (meters, not lat/lon).

```json
{
  "map_name": "yas_marina",
  "boundaries": {
    "left_border":  [[x, y], ...],   // 5913 points
    "right_border": [[x, y], ...]    // 6114 points
  }
}
```

**Key facts:**
- Coordinate system: local Cartesian (meters), same frame as `state_estimation` position
- Centerline: compute as midpoint between left and right borders (interpolated at matching indices up to `min(5913, 6114) = 5913` points)
- Approximate lap length: **2451 meters** (pre-computed from boundary data)
- The circuit is a **closed loop** — the last point connects back to the first

---

## 2. Architecture Overview

```
MCAP Files
    │
    ▼
[Parser Module]          parse_mcap.py
    │  Extracts StateEstimation @ 100Hz → list of Frame dicts
    ▼
[Track Module]           track.py
    │  Loads boundaries, builds centerline, computes cumulative distance
    │  Projects each frame onto track → adds lap_distance_m field
    ▼
[Lap Aligner]            aligner.py
    │  Detects lap start/end, aligns good_lap vs fast_lap by lap_distance_m
    │  Resamples both to a common distance grid (every 1 m)
    ▼
[Segment Detector]       segments.py
    │  Labels each distance point as: straight / braking / corner / acceleration
    │  Assigns corner names (Turn 1–16 for Yas Marina North)
    ▼
[Live Coaching Engine]   live_coach.py
    │  For each incoming frame: find nearest reference frame by distance
    │  Compute deltas, classify gap, emit coaching cue
    ▼
[Post Analysis Engine]   post_analysis.py
    │  Per-segment: entry/apex/exit speed, brake point diff, throttle diff, line deviation
    │  Time loss estimation per corner
    │  Ranked improvement list
    ▼
[NL Report Generator]    report_generator.py
    │  Calls Claude claude-sonnet-4-20250514 (or uses rule templates) to generate
    │  human-readable coaching text from structured segment data
    ▼
[FastAPI App]            main.py
    │  REST endpoints + SSE stream
    ▼
Frontend / UI
```

---

## 3. Module Specifications

### 3.1 `parse_mcap.py` — MCAP Parser

**Purpose:** Read an MCAP file and return a list of telemetry frames from `/constructor0/state_estimation`.

```python
from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class TelemetryFrame:
    timestamp_ns: int          # ROS timestamp in nanoseconds
    timestamp_s: float         # seconds (timestamp_ns / 1e9)
    x: float                   # position x (meters)
    y: float                   # position y (meters)
    z: float                   # position z (meters)
    vx: float                  # forward velocity (m/s)
    vy: float                  # lateral velocity (m/s)
    speed_ms: float            # computed: sqrt(vx^2 + vy^2)
    speed_kph: float           # speed_ms * 3.6
    throttle: float            # 0.0–1.0
    brake: float               # 0.0–1.0
    steering: float            # radians
    gear: int
    # Optional enriched fields (filled by track module)
    lap_distance_m: float = 0.0
    segment_type: str = ""     # "straight" | "braking" | "corner" | "acceleration"
    corner_name: str = ""      # e.g. "Turn 3" or ""
```

**Implementation notes:**

```python
def parse_mcap(filepath: str) -> List[TelemetryFrame]:
    """
    Open the MCAP file using mcap library.
    Iterate messages on topic '/constructor0/state_estimation'.
    Deserialize using mcap-ros2-support (CDR encoding).
    
    The StateEstimation message fields map as follows:
    - msg.pose.position.x → x
    - msg.pose.position.y → y  
    - msg.pose.position.z → z
    - msg.twist.linear.x → vx
    - msg.twist.linear.y → vy
    - msg.additional_state.gas → throttle
    - msg.additional_state.brake → brake
    - msg.additional_state.steering_angle → steering
    - msg.additional_state.gear → gear
    
    If the exact field names differ due to custom ROS2 message types,
    inspect the sd_msgs/ message definitions included in the dataset.
    
    Sort frames by timestamp_ns ascending before returning.
    Compute speed_ms = sqrt(vx**2 + vy**2) for each frame.
    """
```

**Fallback:** If `state_estimation` deserialization fails due to custom message type,
fall back to reading `/constructor0/vectornav/raw/gps` for position and
`/constructor0/can/kistler_correvit` for speed + slip angle.

---

### 3.2 `track.py` — Track Model

**Purpose:** Load the Yas Marina boundary JSON, build the centerline, and provide spatial projection utilities.

```python
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple

@dataclass
class TrackModel:
    left_border: np.ndarray        # shape (5913, 2)
    right_border: np.ndarray       # shape (6114, 2)
    centerline: np.ndarray         # shape (5913, 2) — midpoint of borders
    cumulative_dist: np.ndarray    # shape (5913,) — distance along centerline in meters
    total_lap_length: float        # ~2451.0 meters

def load_track(json_path: str) -> TrackModel:
    """
    Load yas_marina_bnd.json.
    Compute centerline as midpoint between left_border[i] and right_border[i]
    for i in range(min(len(left_border), len(right_border))).
    Compute cumulative_dist using np.cumsum of Euclidean distances between
    consecutive centerline points.
    """

def project_to_track(x: float, y: float, track: TrackModel) -> Tuple[float, float]:
    """
    Find the nearest centerline point to (x, y).
    Return (lap_distance_m, cross_track_error_m).
    
    lap_distance_m: the cumulative distance at the nearest centerline index
    cross_track_error_m: signed lateral offset from centerline
      positive = left of centerline (inside or outside depending on turn direction)
      negative = right of centerline
    
    Use np.argmin(np.hypot(centerline[:,0]-x, centerline[:,1]-y)) for efficiency.
    """

def enrich_frames(frames: List[TelemetryFrame], track: TrackModel) -> List[TelemetryFrame]:
    """
    For each frame, call project_to_track and set frame.lap_distance_m.
    Also store cross_track_error on the frame (add this field to TelemetryFrame).
    Return enriched frames.
    """
```

---

### 3.3 `aligner.py` — Lap Aligner

**Purpose:** Detect lap boundaries, isolate the best single lap from the fast file, and resample both laps onto a common 1-meter distance grid.

```python
import numpy as np
from scipy.interpolate import interp1d
from typing import List, Dict

def detect_lap_start(frames: List[TelemetryFrame], track: TrackModel) -> List[int]:
    """
    Find indices where the car crosses the start/finish line.
    Strategy:
    - The start/finish line is at lap_distance_m ≈ 0 (or ≈ total_lap_length).
    - Detect when lap_distance_m resets (drops from ~total_lap_length back to ~0).
    - Return list of frame indices that mark lap starts.
    """

def extract_best_lap(frames: List[TelemetryFrame]) -> List[TelemetryFrame]:
    """
    For hackathon_fast_laps.mcap which contains two laps:
    - Detect both laps using detect_lap_start.
    - Compute lap time for each (timestamp of end - timestamp of start).
    - Return frames of the faster lap only.
    """

def resample_lap(
    frames: List[TelemetryFrame],
    grid_step_m: float = 1.0
) -> Dict[str, np.ndarray]:
    """
    Resample a lap onto a uniform distance grid (every grid_step_m meters).
    
    Returns a dict with arrays all of shape (N,) where N = int(total_lap_length / grid_step_m):
    {
        "distance":   np.ndarray,  # 0, 1, 2, ..., 2450
        "speed_kph":  np.ndarray,
        "throttle":   np.ndarray,
        "brake":      np.ndarray,
        "steering":   np.ndarray,
        "x":          np.ndarray,
        "y":          np.ndarray,
        "timestamp_s": np.ndarray,
        "cross_track": np.ndarray,
    }
    
    Use scipy.interpolate.interp1d with kind='linear' on (lap_distance_m, value).
    Handle the closed-loop wrap-around carefully.
    """

def align_laps(
    user_frames: List[TelemetryFrame],
    ref_frames: List[TelemetryFrame],
    grid_step_m: float = 1.0
) -> Tuple[Dict, Dict]:
    """
    Resample both laps to the same distance grid.
    Return (user_resampled, ref_resampled) — both dicts with identical distance arrays.
    """
```

---

### 3.4 `segments.py` — Segment & Corner Detector

**Purpose:** Label each distance point with a segment type and corner name for Yas Marina North layout.

```python
# Yas Marina North corner map (approximate lap_distance_m ranges)
# These are estimated from the 2451m layout — adjust based on actual telemetry
YAS_MARINA_CORNERS = [
    {"name": "Turn 1",  "dist_start": 0,    "dist_end": 120,  "type": "corner"},
    {"name": "Turn 2",  "dist_start": 120,  "dist_end": 220,  "type": "corner"},
    {"name": "Turn 3",  "dist_start": 350,  "dist_end": 450,  "type": "corner"},
    {"name": "Turn 4",  "dist_start": 500,  "dist_end": 600,  "type": "corner"},
    {"name": "Turn 5",  "dist_start": 700,  "dist_end": 800,  "type": "corner"},
    {"name": "Turn 6",  "dist_start": 900,  "dist_end": 980,  "type": "corner"},
    {"name": "Turn 7",  "dist_start": 1050, "dist_end": 1150, "type": "corner"},
    {"name": "Turn 8",  "dist_start": 1200, "dist_end": 1300, "type": "corner"},
    {"name": "Turn 9",  "dist_start": 1350, "dist_end": 1430, "type": "corner"},
    {"name": "Turn 10", "dist_start": 1500, "dist_end": 1580, "type": "corner"},
    {"name": "Turn 11", "dist_start": 1650, "dist_end": 1750, "type": "corner"},
    {"name": "Turn 12", "dist_start": 1800, "dist_end": 1880, "type": "corner"},
    {"name": "Turn 13", "dist_start": 1950, "dist_end": 2050, "type": "corner"},
    {"name": "Turn 14", "dist_start": 2100, "dist_end": 2180, "type": "corner"},
    {"name": "Turn 15", "dist_start": 2230, "dist_end": 2320, "type": "corner"},
    {"name": "Turn 16", "dist_start": 2360, "dist_end": 2430, "type": "corner"},
]

# IMPORTANT: Auto-detect corners from telemetry instead of hardcoding
# Use the following signal-based approach:

def detect_segments_from_telemetry(
    ref_resampled: Dict[str, np.ndarray]
) -> List[Dict]:
    """
    Detect segment types from the REFERENCE lap telemetry automatically.
    
    Algorithm:
    1. Compute lateral acceleration proxy: ay_proxy = speed_ms * d(steering)/dt
       (or use actual ay from kistler_acc_body if available)
    2. Smooth with a rolling window (window = 20 samples at 1m grid = 20m)
    3. Label each distance point:
       - abs(ay) < 0.5 m/s² AND brake < 0.05 AND throttle > 0.7 → "straight"
       - brake > 0.15 → "braking"  
       - abs(ay) > 1.5 m/s² → "corner"
       - throttle > 0.6 AND abs(ay) > 0.5 → "acceleration"
    4. Group consecutive same-type points into segments
    5. Filter out segments shorter than 20m (noise)
    6. Label corner segments as "Turn N" sequentially around the lap
    
    Return list of segment dicts:
    {
        "name": "Turn 3",
        "type": "corner",      # or "straight" | "braking" | "acceleration"
        "dist_start": 340.0,
        "dist_end": 460.0,
        "apex_dist": 400.0,    # distance of minimum speed (for corners)
    }
    """
```

---

### 3.5 `live_coach.py` — Live Coaching Engine

**Purpose:** Given the current position in the user's lap, produce a single coaching cue by comparing to the reference at the same track distance.

```python
from enum import Enum
from dataclasses import dataclass
from typing import Optional

class CueType(str, Enum):
    BRAKE_LATER      = "BRAKE_LATER"
    BRAKE_EARLIER    = "BRAKE_EARLIER"
    THROTTLE_EARLIER = "THROTTLE_EARLIER"
    THROTTLE_LATER   = "THROTTLE_LATER"
    CARRY_MORE_SPEED = "CARRY_MORE_SPEED"
    REDUCE_ENTRY_SPEED = "REDUCE_ENTRY_SPEED"
    SMOOTH_STEERING  = "SMOOTH_STEERING"
    LINE_TOO_WIDE    = "LINE_TOO_WIDE"
    LINE_TOO_TIGHT   = "LINE_TOO_TIGHT"
    GOOD_EXIT        = "GOOD_EXIT"
    ON_TARGET        = "ON_TARGET"

class CueSeverity(str, Enum):
    INFO    = "INFO"     # green — on target
    WARN    = "WARN"     # yellow — minor deviation
    ALERT   = "ALERT"   # red — significant gap

@dataclass
class LiveCue:
    cue_type: CueType
    severity: CueSeverity
    short_message: str          # max 4 words — for HUD display
    audio_message: str          # spoken aloud — max 8 words
    lap_distance_m: float
    segment_name: str           # e.g. "Turn 3"
    delta_speed_kph: float      # user speed - ref speed (negative = slower)
    delta_brake_m: float        # estimated braking point difference in meters
    delta_throttle_s: float     # throttle application delay in seconds
    time_loss_estimate_s: float # estimated time loss at this point

def compute_live_cue(
    current_distance_m: float,
    user_speed_kph: float,
    user_throttle: float,
    user_brake: float,
    user_steering: float,
    ref_resampled: Dict[str, np.ndarray],
    segments: List[Dict],
    lookahead_m: float = 50.0,
) -> LiveCue:
    """
    Core live coaching logic.
    
    Steps:
    1. Find reference values at current_distance_m (nearest index in ref distance grid)
    2. Find current segment from segments list
    3. Look ahead lookahead_m to anticipate next action
    4. Compute deltas:
       - speed_delta = user_speed_kph - ref_speed_kph
       - throttle_delta = user_throttle - ref_throttle
       - brake_delta = user_brake - ref_brake
       - steering_delta = abs(user_steering) - abs(ref_steering)
    5. Determine primary gap using priority order:
       PRIORITY 1: Braking zone → if ref is braking but user is not → BRAKE_LATER warning
       PRIORITY 2: Corner entry → if speed_delta < -5 kph → CARRY_MORE_SPEED
       PRIORITY 3: Corner exit → if throttle_delta < -0.15 and brake < 0.05 → THROTTLE_EARLIER
       PRIORITY 4: Line → if cross_track deviation > 3.0 m from reference line → LINE_*
       PRIORITY 5: On target → all deltas within threshold → ON_TARGET / GOOD_EXIT
    6. Estimate time loss for this gap:
       time_loss_s = abs(speed_delta_ms) * segment_length_m / ref_avg_speed_ms²
       (simplified kinematic estimate)
    7. Generate short_message and audio_message strings
    
    Thresholds:
    - speed: INFO < 3 kph, WARN 3–8 kph, ALERT > 8 kph
    - brake point: INFO < 5 m, WARN 5–15 m, ALERT > 15 m
    - throttle delay: INFO < 0.1 s, WARN 0.1–0.3 s, ALERT > 0.3 s
    - line deviation: INFO < 1.5 m, WARN 1.5–3 m, ALERT > 3 m
    
    Short message examples (≤4 words):
    - "Brake later"
    - "More entry speed"
    - "Earlier throttle"
    - "Tighten the line"
    - "Good exit"
    
    Audio message examples (≤8 words):
    - "Brake 10 metres later into Turn 3."
    - "Carry more speed through the apex."
    - "Get on throttle sooner on exit."
    - "Smooth the steering input."
    """
```

---

### 3.6 `post_analysis.py` — Post-Session Analysis Engine

**Purpose:** Compute the full corner-by-corner breakdown and produce structured coaching data.

```python
@dataclass
class CornerAnalysis:
    corner_name: str
    dist_start: float
    dist_end: float
    apex_dist: float

    # User lap metrics
    user_entry_speed_kph: float
    user_apex_speed_kph: float
    user_exit_speed_kph: float
    user_brake_start_dist: float      # distance where brake > 0.1
    user_throttle_start_dist: float   # distance where throttle > 0.5 post-apex

    # Reference lap metrics
    ref_entry_speed_kph: float
    ref_apex_speed_kph: float
    ref_exit_speed_kph: float
    ref_brake_start_dist: float
    ref_throttle_start_dist: float

    # Deltas
    brake_point_delta_m: float         # positive = user brakes earlier
    apex_speed_delta_kph: float        # positive = user faster at apex
    exit_speed_delta_kph: float        # positive = user faster on exit
    throttle_delay_delta_m: float      # positive = user picks up throttle later

    # Line analysis
    avg_line_deviation_m: float        # average lateral offset from reference line
    max_line_deviation_m: float

    # Time loss
    estimated_time_loss_s: float       # total time lost in this corner vs reference
    time_loss_breakdown: Dict          # {"entry": x, "apex": x, "exit": x}

    # Coaching verdict
    primary_issue: str                 # "early_braking" | "slow_apex" | "late_throttle" | "line" | "good"
    coaching_priority: int             # 1 = biggest gain, lower = less important

@dataclass
class PostAnalysisResult:
    lap_time_user_s: float
    lap_time_ref_s: float
    total_time_gap_s: float
    consistency_score: float           # 0–100, based on speed variance

    corners: List[CornerAnalysis]      # one per detected corner
    
    top_3_improvements: List[Dict]     # ranked by estimated_time_loss_s
    # Each: {"corner": "Turn 3", "issue": "early_braking", "gain_s": 0.4, "suggestion": "..."}

    strongest_section: str             # corner name with best relative performance
    weakest_section: str               # corner name with worst time loss

    overall_scores: Dict               # {"braking": 72, "line": 65, "throttle": 81, "smoothness": 78}
    # Scores 0–100, derived from delta magnitudes normalized against reference

def compute_post_analysis(
    user_resampled: Dict[str, np.ndarray],
    ref_resampled: Dict[str, np.ndarray],
    segments: List[Dict],
) -> PostAnalysisResult:
    """
    For each corner segment:
    1. Slice both user and ref arrays to [dist_start : dist_end]
    2. Find entry speed: speed at dist_start + 10m
    3. Find apex: index of minimum speed within segment
    4. Find exit speed: speed at dist_end - 10m
    5. Find brake start: first index where brake > 0.1 (searching backwards from apex)
    6. Find throttle pickup: first index where throttle > 0.5 after apex
    7. Compute deltas
    8. Compute line deviation: mean abs(user_cross_track - ref_cross_track) per segment
    9. Estimate time loss using trapezoidal integration of speed difference:
       time_loss_s = integral((1/user_speed - 1/ref_speed) * d_distance)
       over the segment where user is slower
    10. Assign coaching_priority by sorting corners descending by estimated_time_loss_s
    
    Overall scores:
    - braking_score = 100 - clamp(mean(brake_point_delta_m) / 20 * 100, 0, 100)
    - throttle_score = 100 - clamp(mean(throttle_delay_delta_m) / 30 * 100, 0, 100)
    - line_score = 100 - clamp(mean(avg_line_deviation_m) / 5 * 100, 0, 100)
    - smoothness_score = 100 - clamp(std(user_steering) / std(ref_steering) * 50, 0, 100)
    """
```

---

### 3.7 `report_generator.py` — Natural Language Coaching Report

**Purpose:** Turn the structured `PostAnalysisResult` into human-readable coaching text, personalized by driver level.

```python
DRIVER_LEVELS = ["beginner", "intermediate", "advanced", "pro"]

def generate_coaching_report(
    analysis: PostAnalysisResult,
    driver_level: str = "intermediate",
    driver_name: str = "Driver",
) -> Dict:
    """
    Generate a structured coaching report dict:
    
    {
      "executive_summary": str,     # 2-3 sentence overview
      "biggest_win": str,           # top improvement opportunity
      "best_section": str,          # positive reinforcement
      "corner_reports": [           # one per corner, ordered by priority
        {
          "corner": "Turn 3",
          "headline": str,          # one-line diagnosis
          "detail": str,            # 2-3 sentence explanation
          "instruction": str,       # specific next-lap action
          "time_gain": "~0.4s"
        }
      ],
      "next_session_focus": [str, str, str],  # top 3 priorities
      "scores": { "braking": 72, "line": 65, "throttle": 81, "smoothness": 78 }
    }
    
    Language style by driver_level:
    
    beginner:
      "In Turn 3, you're braking a bit too early. Try waiting until you see the 
       brake marker before squeezing the pedal. This should give you more speed 
       through the corner."
    
    intermediate:
      "Turn 3: braking point is 14m earlier than reference. Release threshold 
       braking progressively into the apex to carry another 8 km/h through 
       the mid-corner."
    
    advanced:
       "Turn 3: you're over-slowing the entry by 14m. Trail brake deeper to 
        delay weight transfer, tighten the rotation, and pick up throttle at 
        the apex earlier — the exit loss costs ~0.3s by Turn 4."
    
    pro:
       "T3: brake reference is 14m early. Trail deeper with progressive release 
        to maximise rotation before apex. Throttle uptake is 0.4s delayed — 
        exit speed is costing 0.31s to the next brake point."
    
    Option A (preferred): Use Claude API internally
    Call claude-sonnet-4-20250514 with a structured prompt containing
    the analysis data and driver level. Parse the JSON response.
    
    Option B (fallback): Use rule-based templates
    Build conditional string templates for each primary_issue type
    and driver_level combination.
    
    Always implement Option B as fallback if API call fails.
    """

# Template structure for Option B fallback:
ISSUE_TEMPLATES = {
    ("early_braking", "beginner"): (
        "In {corner}, you brake earlier than needed. "
        "Try waiting a little longer before braking — aim for {brake_delta:.0f} metres later. "
        "This will help you carry more speed into the corner."
    ),
    ("early_braking", "intermediate"): (
        "{corner}: brake point is {brake_delta:.0f}m early vs reference. "
        "Delay braking and release progressively to carry {apex_delta:.1f} km/h more mid-corner."
    ),
    ("early_braking", "advanced"): (
        "{corner}: over-braking by {brake_delta:.0f}m. Trail deeper with progressive release "
        "to improve rotation. Exit speed delta of {exit_delta:.1f} km/h costs ~{time_loss:.2f}s."
    ),
    # ... repeat for: slow_apex, late_throttle, line, good
}
```

---

## 4. FastAPI Application

### 4.1 `main.py` — API Server

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ApexCoach Backend", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
```

### 4.2 Endpoints

#### `GET /health`
Returns server status and whether telemetry files are loaded.

```json
{
  "status": "ok",
  "files_loaded": {"good_lap": true, "fast_lap": true},
  "track_loaded": true
}
```

---

#### `POST /session/load`
Load and process both MCAP files. Should be called once at startup or on demand.

**Request body:**
```json
{
  "good_lap_path": "data/hackathon_good_lap.mcap",
  "fast_lap_path": "data/hackathon_fast_laps.mcap",
  "track_path": "data/yas_marina_bnd.json"
}
```

**Response:**
```json
{
  "status": "loaded",
  "good_lap_frames": 8130,
  "ref_lap_frames": 7430,
  "ref_lap_time_s": 74.3,
  "good_lap_time_s": 81.3,
  "time_gap_s": 7.0,
  "segments_detected": 16,
  "track_length_m": 2451.0
}
```

---

#### `GET /track`
Return track boundary and centerline data for map rendering.

**Response:**
```json
{
  "map_name": "yas_marina",
  "track_length_m": 2451.0,
  "left_border": [[x, y], ...],
  "right_border": [[x, y], ...],
  "centerline": [[x, y], ...],
  "segments": [
    {
      "name": "Turn 3",
      "type": "corner",
      "dist_start": 340.0,
      "dist_end": 460.0,
      "apex_dist": 400.0
    }
  ]
}
```

---

#### `GET /reference/trace`
Return the reference lap's resampled trace for overlay rendering.

**Response:**
```json
{
  "distance": [0, 1, 2, ...],
  "speed_kph": [...],
  "throttle": [...],
  "brake": [...],
  "x": [...],
  "y": [...],
  "lap_time_s": 74.3
}
```

---

#### `GET /user/trace`
Return the user (good) lap's resampled trace.

Same schema as `/reference/trace` but for the good lap.

---

#### `GET /live/stream`
**Server-Sent Events stream** — streams the user lap as if it were happening live.

Each event is a JSON object:

```json
{
  "event": "frame",
  "data": {
    "elapsed_s": 12.4,
    "lap_distance_m": 312.0,
    "speed_kph": 187.3,
    "throttle": 0.0,
    "brake": 0.82,
    "steering": -0.12,
    "x": 145.2,
    "y": 280.4,
    "segment": "Turn 3",
    "cue": {
      "type": "BRAKE_LATER",
      "severity": "WARN",
      "short_message": "Brake later",
      "audio_message": "Brake 12 metres later here.",
      "delta_speed_kph": -9.2,
      "delta_brake_m": 12.0,
      "time_loss_estimate_s": 0.21
    },
    "ref_speed_kph": 196.5,
    "delta_speed_kph": -9.2,
    "delta_time_s": -1.4
  }
}
```

**Query parameters:**
- `playback_speed` (float, default 1.0) — multiply replay speed (use 2.0 for faster demo)
- `driver_level` (str, default "intermediate")

**Implementation:**
```python
@app.get("/live/stream")
async def live_stream(playback_speed: float = 1.0, driver_level: str = "intermediate"):
    async def event_generator():
        for i, frame in enumerate(user_frames):
            cue = compute_live_cue(...)
            data = {...}
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(0.01 / playback_speed)  # ~100Hz playback
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

#### `GET /analysis/post`
Return the full post-session analysis.

**Query parameters:**
- `driver_level` (str, default "intermediate")
- `driver_name` (str, default "Driver")

**Response:**
```json
{
  "session": {
    "user_lap_time_s": 81.3,
    "ref_lap_time_s": 74.3,
    "total_time_gap_s": 7.0,
    "consistency_score": 82
  },
  "overall_scores": {
    "braking": 68,
    "line": 71,
    "throttle": 75,
    "smoothness": 80
  },
  "top_3_improvements": [
    {
      "corner": "Turn 3",
      "issue": "early_braking",
      "gain_s": 0.42,
      "suggestion": "Brake 14m later and release progressively."
    }
  ],
  "strongest_section": "Turn 11",
  "weakest_section": "Turn 3",
  "corners": [
    {
      "corner_name": "Turn 3",
      "coaching_priority": 1,
      "user_entry_speed_kph": 187.0,
      "ref_entry_speed_kph": 201.0,
      "user_apex_speed_kph": 112.0,
      "ref_apex_speed_kph": 124.0,
      "user_exit_speed_kph": 145.0,
      "ref_exit_speed_kph": 159.0,
      "brake_point_delta_m": 14.0,
      "throttle_delay_delta_m": 18.0,
      "avg_line_deviation_m": 1.8,
      "estimated_time_loss_s": 0.42,
      "primary_issue": "early_braking"
    }
  ],
  "coaching_report": {
    "executive_summary": "...",
    "biggest_win": "...",
    "best_section": "...",
    "corner_reports": [...],
    "next_session_focus": ["...", "...", "..."]
  }
}
```

---

#### `GET /analysis/speed-trace`
Return speed traces of both laps on a common distance axis for chart overlay.

**Response:**
```json
{
  "distance_m": [0, 1, 2, ...],
  "user_speed_kph": [...],
  "ref_speed_kph": [...],
  "speed_delta_kph": [...],
  "user_throttle": [...],
  "ref_throttle": [...],
  "user_brake": [...],
  "ref_brake": [...],
  "segments": [...]
}
```

---

#### `GET /analysis/time-loss-map`
Return per-meter time loss for the track heatmap.

**Response:**
```json
{
  "distance_m": [...],
  "time_loss_per_meter_s": [...],
  "x": [...],
  "y": [...],
  "cumulative_time_loss_s": [...]
}
```

Computed as: at each meter, `1/user_speed_ms - 1/ref_speed_ms` (positive = user losing time).

---

## 5. Project File Structure

```
apexcoach-backend/
├── main.py                  # FastAPI app and all endpoints
├── parse_mcap.py            # MCAP parser
├── track.py                 # Track model and projection
├── aligner.py               # Lap alignment and resampling
├── segments.py              # Segment/corner detection
├── live_coach.py            # Live coaching cue engine
├── post_analysis.py         # Post-session analysis
├── report_generator.py      # NL coaching report
├── models.py                # Shared dataclasses / Pydantic models
├── config.py                # File paths, thresholds, constants
├── data/
│   ├── hackathon_good_lap.mcap
│   ├── hackathon_fast_laps.mcap
│   └── yas_marina_bnd.json
├── requirements.txt
└── README.md
```

### `requirements.txt`
```
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
mcap>=1.1.0
mcap-ros2-support>=0.4.0
numpy>=1.26.0
scipy>=1.12.0
shapely>=2.0.0
httpx>=0.27.0
anthropic>=0.25.0
```

---

## 6. Startup & Data Flow

```python
# main.py — on server startup, pre-load everything into memory

from contextlib import asynccontextmanager

_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load track
    track = load_track("data/yas_marina_bnd.json")
    
    # Parse MCAP files
    good_frames = parse_mcap("data/hackathon_good_lap.mcap")
    fast_frames = parse_mcap("data/hackathon_fast_laps.mcap")
    
    # Enrich with track distance
    good_frames = enrich_frames(good_frames, track)
    fast_frames  = enrich_frames(fast_frames, track)
    
    # Extract best lap from fast file
    ref_frames = extract_best_lap(fast_frames)
    
    # Resample to 1m grid
    user_resampled, ref_resampled = align_laps(good_frames, ref_frames)
    
    # Detect segments
    segments = detect_segments_from_telemetry(ref_resampled)
    
    # Pre-compute post analysis
    analysis = compute_post_analysis(user_resampled, ref_resampled, segments)
    
    _state.update({
        "track": track,
        "user_frames": good_frames,
        "ref_frames": ref_frames,
        "user_resampled": user_resampled,
        "ref_resampled": ref_resampled,
        "segments": segments,
        "analysis": analysis,
    })
    yield

app = FastAPI(lifespan=lifespan)
```

---

## 7. Key Implementation Rules

1. **All positions are in local XY meters** — same coordinate frame as the boundary JSON. Do not convert to lat/lon.

2. **Lap distance is the single alignment variable** — never align by timestamp. Always align user vs reference by `lap_distance_m`.

3. **The reference lap is ground truth** — never use the user lap to calibrate thresholds. All coaching deltas are `user_value - ref_value`.

4. **Live cues must be singular** — only one primary cue per frame. Priority order: braking > speed > throttle > line > on_target.

5. **Time loss estimates must be physics-based** — use the trapezoidal integral of `(1/v_user - 1/v_ref) * ds` per segment, not guesswork.

6. **Segment detection must be automatic** — derive corners from the reference telemetry's lateral acceleration and steering profile. Do not hardcode distances.

7. **All API responses are JSON** — no plain text endpoints except the SSE stream.

8. **FastAPI startup pre-computes everything** — parsing and analysis runs once at boot. All endpoints serve from in-memory state. MCAP parsing can take 5–15 seconds; that is acceptable.

9. **MCAP custom message types** — the dataset ships with `sd_msgs/` ROS2 message definitions. The `mcap-ros2-support` library may need these definitions to deserialize custom types. If it cannot find them automatically, fall back to raw CDR byte parsing or read the `sd_msgs/` `.msg` files to build a manual deserializer.

10. **Error handling** — if MCAP parsing of `state_estimation` fails, log the error and attempt fallback topics (`gps` + `correvit`). Never crash silently.

---

## 8. Output Contract Summary

Every response the frontend receives must conform to this contract:

| Endpoint | Primary consumer | Render as |
|----------|-----------------|-----------|
| `/track` | Map component | SVG/Canvas track drawing |
| `/reference/trace` + `/user/trace` | Speed trace chart | Multi-line chart overlay |
| `/live/stream` | Live HUD | Real-time cue + speed gauge |
| `/analysis/post` | Post-session report | Corner cards + coach text |
| `/analysis/speed-trace` | Overlay chart | Dual speed + throttle/brake |
| `/analysis/time-loss-map` | Heatmap on track | Color-coded track path |

---

## 9. Demo Script (for Hackathon)

The intended demo flow is:

1. **Server starts** → loads both MCAP files, parses ~16,000 frames, pre-computes analysis
2. **Frontend calls `/track`** → renders Yas Marina map with sector lines
3. **Frontend calls `/live/stream`** → plays back good_lap, showing live HUD cues
4. **Audience watches** cues like "Brake later — Turn 3" appear at the right moment
5. **Playback ends** → frontend calls `/analysis/post` → shows full corner report
6. **Judge sees** Turn-by-turn time loss, scores, and personalized coaching language

The entire flow must run end-to-end from real MCAP data. No hardcoded outputs.

---

*This specification is complete. Implement each module in order: `parse_mcap.py` → `track.py` → `aligner.py` → `segments.py` → `live_coach.py` → `post_analysis.py` → `report_generator.py` → `main.py`.*
