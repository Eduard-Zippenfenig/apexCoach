# ApexCoach — Technical README
> **Purpose of this document:** Fully explain the ApexCoach system's architecture, data flow, and especially the **good lap vs. fastest lap simulation logic** so that any Claude instance can understand and extend it without needing to read the source code first.

---

## 1. What ApexCoach Does

ApexCoach is a motorsport AI coaching engine for the **Yas Marina Formula 1 circuit**. It takes two MCAP telemetry recordings — a "good lap" and a "fast laps" file — and:

1. Replays the **good lap** in real time via a browser dashboard (SSE stream).
2. At every frame of the replay, compares the good lap against the **fastest lap** (extracted from the fast laps file).
3. Generates live coaching cues ("Brake later", "More entry speed", etc.) based on the deltas.
4. Also provides a static **post-session analysis** with per-corner breakdowns and time loss estimates.

---

## 2. Project Structure

```
hackathon/
├── apexcoach-backend/
│   ├── main.py             # FastAPI app — all API endpoints + SSE stream
│   ├── config.py           # All constants, file paths, thresholds
│   ├── models.py           # Dataclasses: TelemetryFrame, LiveCue, CornerAnalysis, etc.
│   ├── parse_mcap.py       # Reads .mcap files → list of TelemetryFrame
│   ├── track.py            # Loads Yas Marina JSON, computes lap_distance_m & cross_track_error_m
│   ├── aligner.py          # Lap extraction + resampling to 1m grid
│   ├── segments.py         # Detects corners/straights/braking zones from ref lap
│   ├── live_coach.py       # Per-frame coaching cue generator (good vs fast comparison)
│   ├── post_analysis.py    # Static corner-by-corner analysis
│   ├── report_generator.py # Text coaching report from post analysis
│   └── data/
│       ├── hackathon_good_lap.mcap     # The "good" driver's lap recording
│       ├── hackathon_fast_laps.mcap    # Fastest driver's lap recording
│       └── yas_marina_bnd.json         # Track boundary + centerline geometry
│
└── apexcoach-frontend/
    ├── index.html          # Dashboard HTML
    ├── app.js              # All frontend logic — SSE consumer + canvas map
    └── style.css           # Dark-mode dashboard styling
```

---

## 3. Data Flow — Startup

When the backend starts (`python main.py`), `_load_session()` runs this pipeline:

```
Step 1: load_track(yas_marina_bnd.json)
        → TrackModel (centerline, left/right borders, total_lap_length ~5281m)

Step 2: parse_mcap(good_lap.mcap)   → List[TelemetryFrame]  (good_frames)
        parse_mcap(fast_laps.mcap)  → List[TelemetryFrame]  (fast_frames)

Step 3: enrich_frames(good_frames, track)
        enrich_frames(fast_frames, track)
        → Adds lap_distance_m and cross_track_error_m to every TelemetryFrame
          by projecting (x, y) onto the nearest point of the centerline.

Step 4: extract_best_lap(fast_frames, track)
        → If fast_laps.mcap contains multiple laps, picks the fastest one.
          If only one wrap (file starts mid-lap), uses all frames as one lap.
        → ref_frames

Step 5: align_laps(good_frames, ref_frames, track)
        → Resamples BOTH laps onto a shared 1-meter distance grid (0m → ~5281m).
        → user_resampled, ref_resampled
          Each is a dict of numpy arrays:
          {"distance", "speed_kph", "speed_ms", "throttle", "brake",
           "steering", "x", "y", "timestamp_s", "cross_track", "ax", "ay"}

Step 6: detect_segments_from_telemetry(ref_resampled)
        → Uses ref lap's lateral acceleration (ay) + throttle/brake to classify
          every meter as: "straight", "corner", "braking", or "acceleration"
        → Named corners (Turn 1, Turn 3, etc.) based on Yas Marina layout

Step 7: compute_post_analysis(user_resampled, ref_resampled, segments)
        → Full static analysis — per-corner breakdown, scores, time losses

All results stored in the global _state dict for API endpoints to consume.
```

---

## 4. The Core Simulation: Good Lap vs. Fastest Lap

### 4.1 How the Resampling Works (`aligner.py`)

**The problem:** Both MCAP files begin mid-lap (~1830m into the circuit). The `lap_distance_m` values wrap around 0 when crossing the start/finish line. Two different laps driven at different speeds cannot be directly compared using timestamps.

**The solution:** Resample both laps onto a **1-meter distance grid** using unwrapped cumulative distance.

```python
# Step 1: Unwrap lap_distance_m to be monotonically increasing
# If distance drops by >30% of track length, a wrap occurred: add total_lap_length
unwrapped_dist = _unwrap_distances(frames, total_lap_length)
# Example: [4800m, 4900m, 5100m=wrap, 200m] → [4800, 4900, 5100, 5481]

# Step 2: Create uniform 1m grid over the unwrapped range
uw_grid = np.arange(uw[0], uw[-1], grid_step_m=1.0)

# Step 3: Interpolate all signals (speed, throttle, brake, steering, x, y, etc.)
#         onto this uniform grid using linear interpolation

# Step 4: Convert back to wrapped track distance (mod total_lap_length)
wrapped_grid = uw_grid % total_lap_length

# Step 5: Sort by wrapped distance so the array is track-position ordered
```

After this, both `user_resampled` and `ref_resampled` have arrays of equal structure where **index N corresponds to the same track position N meters from the start line** for both laps.

### 4.2 The Live Simulation Stream (`main.py` → `/live/stream`)

The SSE endpoint is the heart of the simulation. It **replays the good lap** frame-by-frame and at each frame queries the resampled fastest lap at the same track distance:

```python
@app.get("/live/stream")
async def live_stream(playback_speed: float):
    user_frames   = _state["user_frames"]     # raw good lap frames (temporal order)
    ref_resampled = _state["ref_resampled"]   # fastest lap on 1m grid

    async def event_generator():
        start_time = user_frames[0].timestamp_s

        for frame in user_frames:  # iterate good lap, frame by frame
            elapsed = frame.timestamp_s - start_time   # good lap elapsed time

            # ─── Look up fastest lap at the same track distance ───
            ref_idx   = np.searchsorted(ref_resampled["distance"], frame.lap_distance_m)
            ref_speed = ref_resampled["speed_kph"][ref_idx]   # fastest lap speed here

            # ─── Compute time delta ───
            # elapsed = time the good lap driver has taken to reach this point
            # ref_time_at_dist = time the fast lap driver took to reach this same point
            ref_time_at_dist = ref_resampled["timestamp_s"][ref_idx] - ref_resampled["timestamp_s"][0]
            delta_time = elapsed - ref_time_at_dist
            # Positive delta_time  → good lap driver is SLOWER (behind the ghost)
            # Negative delta_time  → good lap driver is FASTER (ahead of the ghost)

            # ─── Generate live coaching cue ───
            cue = compute_live_cue(
                current_distance_m   = frame.lap_distance_m,
                user_speed_kph       = frame.speed_kph,
                user_throttle        = frame.throttle,
                user_brake           = frame.brake,
                user_steering        = frame.steering,
                user_cross_track     = frame.cross_track_error_m,
                ref_resampled        = ref_resampled,   # ← fastest lap
                segments             = segments,
            )

            # Emit SSE event with all metrics + cue
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(SSE_FRAME_INTERVAL / playback_speed)
```

**Key insight:** The fast lap is never played back — it's a static reference grid. Only the good lap animates in the UI. The "ghost car" effect is numerical: every frame of the good lap is compared to the fastest lap's value at the same track position.

### 4.3 Per-Frame Comparison Logic (`live_coach.py` → `compute_live_cue()`)

At every frame, the coaching engine does this comparison:

```python
# Find fastest lap data at current track distance
idx = np.searchsorted(ref_resampled["distance"], current_distance_m)

ref_speed     = ref_resampled["speed_kph"][idx]
ref_throttle  = ref_resampled["throttle"][idx]
ref_brake     = ref_resampled["brake"][idx]
ref_steering  = ref_resampled["steering"][idx]
ref_cross_track = ref_resampled["cross_track"][idx]

# Compute deltas
speed_delta    = user_speed_kph - ref_speed        # negative = user slower
throttle_delta = user_throttle  - ref_throttle
line_delta     = user_cross_track - ref_cross_track
```

**Priority-based cue selection** (highest priority first):

| Condition | Cue | Severity |
|---|---|---|
| `ref_brake > 0.15` AND `user_brake < 0.05` | "Brake now" | speed-dependent |
| `user_brake > 0.15` AND `ref_brake < 0.05` | "Brake later" | brake-delta-dependent |
| Corner/braking zone AND `speed_delta < -3 kph` | "More entry speed" | speed-dependent |
| Corner/accel zone AND `throttle_delta < -0.15` | "Earlier throttle" | throttle-dependent |
| `abs(line_delta) > 1.5m` | "Tighten line" / "Wider entry" | line-dependent |
| Corner AND `abs(steering_delta) > 0.1` | "Smooth steering" | WARN |
| Accel zone AND `speed_delta > 3 kph` | "Good exit" | INFO |
| (default) | "On target" | INFO |

**Lookahead (50m):** The engine also checks what the fastest lap is doing 50 meters ahead, to give anticipatory cues (e.g., "brake now" before the actual braking zone).

### 4.4 What the Frontend Receives (SSE payload per frame)

```json
{
  "elapsed_s": 12.34,
  "lap_distance_m": 1234.5,
  "speed_kph": 187.3,
  "throttle": 0.85,
  "brake": 0.0,
  "steering": -0.12,
  "x": 234.5,
  "y": 678.9,
  "gear": 6,
  "segment": "Turn 3",
  "ref_speed_kph": 192.1,
  "delta_speed_kph": -4.8,     ← user is 4.8 kph slower here
  "delta_time_s": 0.34,        ← user is 0.34s behind the fast lap
  "cue": {
    "type": "CARRY_MORE_SPEED",
    "severity": "WARN",
    "short_message": "More entry speed",
    "audio_message": "Carry more speed through Turn 3.",
    "delta_speed_kph": -4.8,
    "delta_brake_m": 0.0,
    "time_loss_estimate_s": 0.021
  }
}
```

### 4.5 Frontend Rendering (`app.js`)

The frontend connects to the SSE stream and at each frame:

1. **Updates HUD numbers**: speed, gear, throttle %, brake %
2. **Shows delta time**: `delta_time_s` displayed as `+0.34s` (red) or `-0.12s` (green)
3. **Shows speed delta**: `delta_speed_kph` — positive means user is faster
4. **Moves car dot** on the track map canvas using `(x, y)` from the good lap frame
5. **Shows coaching overlay** when `cue.severity !== "INFO"` — colored WARN/ALERT

The **track map** is drawn on a `<canvas>` using centerline + border arrays from the `/track` endpoint. The car dot is the only moving element — it traces the good lap's actual GPS path.

---

## 5. Post-Session Analysis (`post_analysis.py`)

This runs once at startup (not in real time). For each detected corner:

- **Entry speed** measured 10m into the corner segment
- **Apex speed** = minimum speed point within the segment
- **Exit speed** measured 10m before segment end
- **Brake start distance**: searches backward from apex until `brake < 0.1`
- **Throttle pickup distance**: searches forward from apex until `throttle > 0.5`
- **Time loss** = `∫(1/v_user - 1/v_ref) dd` over the segment (trapezoidal integration)
  - Positive = user is slower = losing time
- **Primary issue** classified as: `early_braking`, `slow_apex`, `late_throttle`, `line`, or `good`

Corners are ranked by `estimated_time_loss_s` descending → coaching priority 1 = biggest gain available.

**Overall scores (0–100):**
- `braking`: based on avg brake point delta vs 20m norm
- `throttle`: based on avg throttle delay delta vs 30m norm
- `line`: based on avg line deviation vs 5m norm
- `smoothness`: based on steering std ratio vs ref lap

---

## 6. Track Model (`track.py`)

- Loads `yas_marina_bnd.json` which contains `centerline`, `left_border`, `right_border` as arrays of `[x, y]` meter coordinates.
- Computes `total_lap_length` as cumulative arc length of the centerline.
- For each `TelemetryFrame`, `enrich_frames()` projects `(x, y)` onto the centerline using **nearest-neighbor lookup** on a KD-tree.
  - `lap_distance_m` = cumulative arc length to that projection point
  - `cross_track_error_m` = signed perpendicular distance from centerline (positive = right side)

---

## 7. Segment Detection (`segments.py`)

Uses the **reference lap** (fastest) resampled data to classify each meter of track:

- **Lateral acceleration `ay`**: smoothed with a 20-point rolling window
  - `|ay| < 0.5 g` → straight candidate
  - `|ay| > 1.5 g` → corner candidate
- **Brake**: `brake > 0.15` → braking zone
- **Throttle**: `throttle > 0.7` on straights, `> 0.6` in acceleration zones

Short segments (<20m) are merged into neighbors. Each segment gets:
```json
{
  "type": "corner",
  "name": "Turn 3",
  "dist_start": 834.0,
  "dist_end": 921.0,
  "apex_dist": 877.5
}
```

---

## 8. API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Server status |
| `/track` | GET | Centerline, borders, segments (for map rendering) |
| `/live/stream` | GET (SSE) | Real-time good lap replay with coaching cues |
| `/reference/trace` | GET | Fastest lap resampled arrays |
| `/user/trace` | GET | Good lap resampled arrays |
| `/analysis/post` | GET | Full post-session corner analysis + report |
| `/analysis/speed-trace` | GET | Both speed traces on common distance axis |
| `/analysis/time-loss-map` | GET | Per-meter time loss + cumulative + (x,y) for heatmap |
| `/session/load` | POST | Re-load MCAP files at runtime |

---

## 9. Key Configuration Values (`config.py`)

| Constant | Value | Meaning |
|---|---|---|
| `GRID_STEP_M` | 1.0 | Resample resolution: 1 meter per grid point |
| `LOOKAHEAD_M` | 50.0 | Meters ahead to check ref lap for anticipatory cues |
| `SPEED_INFO_THRESH` | 3 kph | Minimum speed delta to trigger INFO cue |
| `SPEED_WARN_THRESH` | 8 kph | Speed delta that escalates to WARN |
| `BRAKE_INFO_THRESH` | 5 m | Brake point delta for INFO |
| `BRAKE_WARN_THRESH` | 15 m | Brake point delta for WARN |
| `LINE_INFO_THRESH` | 1.5 m | Cross-track deviation for INFO |
| `LINE_WARN_THRESH` | 3.0 m | Cross-track deviation for WARN |
| `SSE_FRAME_INTERVAL` | 0.01 s | Base interval = 100 Hz |
| `DEFAULT_PLAYBACK_SPEED` | 1.0 | 1× real time |

---

## 10. Summary: The Ghost Lap Comparison in One Sentence

> The good lap drives through real time via SSE — at each frame, the system finds the exact same track position in the fastest lap's 1-meter-grid reference array, computes speed / throttle / brake / line deltas, and generates a priority-ranked coaching cue based on configurable thresholds, while accumulating the time gap as `∫(1/v_user − 1/v_ref) dd`.
