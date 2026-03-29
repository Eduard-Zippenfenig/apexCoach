"""
ApexCoach Backend — Configuration & Constants
"""
import os

# ─── File Paths ───────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

GOOD_LAP_PATH = os.path.join(DATA_DIR, "hackathon_good_lap.mcap")
FAST_LAP_PATH = os.path.join(DATA_DIR, "hackathon_fast_laps.mcap")
TRACK_JSON_PATH = os.path.join(DATA_DIR, "yas_marina_bnd.json")

# ─── MCAP Topics ──────────────────────────────────────────────
STATE_ESTIMATION_TOPIC = "/constructor0/state_estimation"
KISTLER_ACC_TOPIC = "/constructor0/can/kistler_acc_body"
KISTLER_CORREVIT_TOPIC = "/constructor0/can/kistler_correvit"

# ─── Resampling ───────────────────────────────────────────────
GRID_STEP_M = 1.0  # resample to 1 meter intervals

# ─── Segment Detection ───────────────────────────────────────
SEGMENT_SMOOTH_WINDOW = 20  # rolling window in meters (at 1m grid)
MIN_SEGMENT_LENGTH_M = 20   # discard segments shorter than this

# Thresholds for segment classification (from reference lap)
AY_STRAIGHT_THRESH = 0.5     # |ay| < this → straight
AY_CORNER_THRESH = 1.5       # |ay| > this → corner
BRAKE_THRESH = 0.15           # brake > this → braking zone
THROTTLE_STRAIGHT_THRESH = 0.7  # throttle > this on straight
THROTTLE_ACCEL_THRESH = 0.6     # throttle > this in accel zone

# ─── Live Coaching Thresholds ─────────────────────────────────
# Speed delta thresholds (kph)
SPEED_INFO_THRESH = 3.0
SPEED_WARN_THRESH = 8.0

# Brake point delta thresholds (meters)
BRAKE_INFO_THRESH = 5.0
BRAKE_WARN_THRESH = 15.0

# Throttle delay thresholds (seconds)
THROTTLE_INFO_THRESH = 0.1
THROTTLE_WARN_THRESH = 0.3

# Line deviation thresholds (meters)
LINE_INFO_THRESH = 1.5
LINE_WARN_THRESH = 3.0

# Cue generation
LOOKAHEAD_M = 50.0  # look ahead distance for anticipatory cues

# ─── Post Analysis ────────────────────────────────────────────
BRAKE_DETECT_THRESH = 0.1    # brake > this = braking started
THROTTLE_DETECT_THRESH = 0.5  # throttle > this = throttle picked up
ENTRY_OFFSET_M = 10.0         # entry speed measured at dist_start + this
EXIT_OFFSET_M = 10.0          # exit speed measured at dist_end - this

# ─── Scoring Normalization ────────────────────────────────────
BRAKE_SCORE_NORM = 20.0       # 20m delta = 0 score
THROTTLE_SCORE_NORM = 30.0    # 30m delta = 0 score
LINE_SCORE_NORM = 5.0         # 5m avg deviation = 0 score

# ─── SSE Playback ─────────────────────────────────────────────
DEFAULT_PLAYBACK_SPEED = 1.0
SSE_FRAME_INTERVAL = 0.01     # ~100Hz base interval
