"""
ApexCoach Backend — Shared Data Models
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional


# ─── Telemetry Frame ──────────────────────────────────────────

@dataclass
class TelemetryFrame:
    """Single telemetry sample from StateEstimation."""
    timestamp_ns: int           # ROS timestamp in nanoseconds
    timestamp_s: float          # seconds (timestamp_ns / 1e9)
    x: float                    # position x (meters)
    y: float                    # position y (meters)
    z: float                    # position z (meters)
    vx: float                   # forward velocity (m/s)
    vy: float                   # lateral velocity (m/s)
    speed_ms: float             # total speed (m/s) — from v_mps
    speed_kph: float            # speed_ms * 3.6
    throttle: float             # 0.0–1.0 (gas pedal)
    brake: float                # 0.0–1.0 (brake pedal)
    steering: float             # steering wheel angle (radians)
    gear: int                   # current gear
    ax: float = 0.0             # longitudinal acceleration (m/s²)
    ay: float = 0.0             # lateral acceleration (m/s²)
    yaw: float = 0.0            # heading angle (radians)

    # Enriched by track module
    lap_distance_m: float = 0.0
    cross_track_error_m: float = 0.0

    # Enriched by segment detector
    segment_type: str = ""      # "straight" | "braking" | "corner" | "acceleration"
    corner_name: str = ""       # e.g. "Turn 3" or ""


# ─── Live Coaching ────────────────────────────────────────────

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
    INFO  = "INFO"    # green — on target
    WARN  = "WARN"    # yellow — minor deviation
    ALERT = "ALERT"   # red — significant gap


@dataclass
class LiveCue:
    cue_type: CueType
    severity: CueSeverity
    short_message: str           # max 4 words — for HUD display
    audio_message: str           # spoken aloud — max 8 words
    lap_distance_m: float
    segment_name: str            # e.g. "Turn 3"
    delta_speed_kph: float       # user speed - ref speed (negative = slower)
    delta_brake_m: float         # estimated braking point difference in meters
    delta_throttle_s: float      # throttle application delay in seconds
    time_loss_estimate_s: float  # estimated time loss at this point


# ─── Post Analysis ────────────────────────────────────────────

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
    user_brake_start_dist: float
    user_throttle_start_dist: float

    # Reference lap metrics
    ref_entry_speed_kph: float
    ref_apex_speed_kph: float
    ref_exit_speed_kph: float
    ref_brake_start_dist: float
    ref_throttle_start_dist: float

    # Deltas
    brake_point_delta_m: float          # positive = user brakes earlier
    apex_speed_delta_kph: float         # positive = user faster at apex
    exit_speed_delta_kph: float         # positive = user faster on exit
    throttle_delay_delta_m: float       # positive = user picks up throttle later

    # Line analysis
    avg_line_deviation_m: float
    max_line_deviation_m: float

    # Time loss
    estimated_time_loss_s: float
    time_loss_breakdown: Dict = field(default_factory=dict)

    # Coaching verdict
    primary_issue: str = ""             # "early_braking" | "slow_apex" | "late_throttle" | "line" | "good"
    coaching_priority: int = 0          # 1 = biggest gain


@dataclass
class PostAnalysisResult:
    lap_time_user_s: float
    lap_time_ref_s: float
    total_time_gap_s: float
    consistency_score: float            # 0–100

    corners: List[CornerAnalysis] = field(default_factory=list)

    top_3_improvements: List[Dict] = field(default_factory=list)

    strongest_section: str = ""
    weakest_section: str = ""

    overall_scores: Dict = field(default_factory=dict)
