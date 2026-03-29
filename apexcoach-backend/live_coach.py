"""
ApexCoach Backend — Live Coaching Engine
Produces per-frame coaching cues comparing user performance to reference.
"""
import numpy as np
from typing import List, Dict

from models import LiveCue, CueType, CueSeverity
from segments import get_segment_at_distance
from config import (
    SPEED_INFO_THRESH, SPEED_WARN_THRESH,
    BRAKE_INFO_THRESH, BRAKE_WARN_THRESH,
    THROTTLE_INFO_THRESH, THROTTLE_WARN_THRESH,
    LINE_INFO_THRESH, LINE_WARN_THRESH,
    LOOKAHEAD_M,
)


def compute_live_cue(
    current_distance_m: float,
    user_speed_kph: float,
    user_throttle: float,
    user_brake: float,
    user_steering: float,
    user_cross_track: float,
    ref_resampled: Dict[str, np.ndarray],
    segments: List[Dict],
    lookahead_m: float = LOOKAHEAD_M,
) -> LiveCue:
    """Compute a single prioritised coaching cue for the current position."""
    ref_distance = ref_resampled["distance"]
    idx = int(np.searchsorted(ref_distance, current_distance_m))
    idx = np.clip(idx, 0, len(ref_distance) - 1)

    ref_speed = float(ref_resampled["speed_kph"][idx])
    ref_throttle = float(ref_resampled["throttle"][idx])
    ref_brake = float(ref_resampled["brake"][idx])
    ref_steering = float(ref_resampled["steering"][idx])
    ref_cross_track = float(ref_resampled["cross_track"][idx])

    segment = get_segment_at_distance(current_distance_m, segments)
    seg_name = segment.get("name", "Track")
    seg_type = segment.get("type", "straight")

    ahead_idx = int(np.searchsorted(ref_distance, current_distance_m + lookahead_m))
    ahead_idx = np.clip(ahead_idx, 0, len(ref_distance) - 1)
    ref_brake_ahead = float(ref_resampled["brake"][ahead_idx])

    speed_delta = user_speed_kph - ref_speed
    throttle_delta = user_throttle - ref_throttle
    steering_delta = abs(user_steering) - abs(ref_steering)
    line_delta = user_cross_track - ref_cross_track

    delta_brake_m = _est_brake_delta(current_distance_m, user_brake, ref_resampled)
    delta_throttle_s = _est_throttle_delay(
        current_distance_m, user_throttle, user_speed_kph, ref_resampled
    )

    seg_len = segment.get("dist_end", current_distance_m + 50) - segment.get("dist_start", current_distance_m)
    ref_avg_ms = max(ref_speed / 3.6, 1.0)
    time_loss = min(abs(speed_delta / 3.6) * seg_len / (ref_avg_ms ** 2), 5.0)

    # Priority-based cue selection
    if ref_brake > 0.15 and user_brake < 0.05:
        ct, sev = CueType.BRAKE_EARLIER, _sev_speed(abs(speed_delta))
        short, audio = "Brake now", f"Brake now into {seg_name}."
    elif user_brake > 0.15 and ref_brake < 0.05 and ref_brake_ahead < 0.05:
        ct, sev = CueType.BRAKE_LATER, _sev_brake(abs(delta_brake_m))
        short = "Brake later"
        audio = f"Brake {abs(delta_brake_m):.0f} metres later here."
    elif seg_type in ("corner", "braking") and speed_delta < -SPEED_INFO_THRESH:
        ct, sev = CueType.CARRY_MORE_SPEED, _sev_speed(abs(speed_delta))
        short, audio = "More entry speed", f"Carry more speed through {seg_name}."
    elif seg_type in ("corner", "acceleration") and throttle_delta < -0.15 and user_brake < 0.05:
        ct, sev = CueType.THROTTLE_EARLIER, _sev_throttle(abs(delta_throttle_s))
        short, audio = "Earlier throttle", "Get on throttle sooner on exit."
    elif abs(line_delta) > LINE_INFO_THRESH:
        if line_delta > 0:
            ct = CueType.LINE_TOO_WIDE
            short, audio = "Tighten the line", f"Tighten the line through {seg_name}."
        else:
            ct = CueType.LINE_TOO_TIGHT
            short, audio = "Wider entry line", "Use more track on entry."
        sev = _sev_line(abs(line_delta))
    elif abs(steering_delta) > 0.1 and seg_type == "corner":
        ct, sev = CueType.SMOOTH_STEERING, CueSeverity.WARN
        short, audio = "Smooth steering", "Smooth the steering input."
    elif seg_type == "acceleration" and speed_delta > SPEED_INFO_THRESH:
        ct, sev = CueType.GOOD_EXIT, CueSeverity.INFO
        short, audio = "Good exit", f"Good exit from {seg_name}."
    else:
        ct, sev = CueType.ON_TARGET, CueSeverity.INFO
        short, audio = "On target", "On target, keep it up."

    return LiveCue(
        cue_type=ct, severity=sev,
        short_message=short, audio_message=audio,
        lap_distance_m=current_distance_m, segment_name=seg_name,
        delta_speed_kph=round(speed_delta, 1),
        delta_brake_m=round(delta_brake_m, 1),
        delta_throttle_s=round(delta_throttle_s, 2),
        time_loss_estimate_s=round(time_loss, 3),
    )


def _est_brake_delta(dist, user_brake, ref):
    ref_d, ref_b = ref["distance"], ref["brake"]
    idx = int(np.searchsorted(ref_d, dist))
    idx = np.clip(idx, 0, len(ref_d) - 1)
    if user_brake > 0.1:
        for i in range(max(0, idx - 50), min(len(ref_d), idx + 50)):
            if ref_b[i] > 0.1:
                return float(dist - ref_d[i])
    return 0.0


def _est_throttle_delay(dist, user_th, user_spd, ref):
    ref_d, ref_th = ref["distance"], ref["throttle"]
    idx = int(np.searchsorted(ref_d, dist))
    idx = np.clip(idx, 0, len(ref_d) - 1)
    if float(ref_th[idx]) > 0.5 and user_th < 0.3:
        spd_ms = max(user_spd / 3.6, 1.0)
        for i in range(idx, max(0, idx - 100), -1):
            if ref_th[i] < 0.3:
                return float(ref_d[idx] - ref_d[i]) / spd_ms
    return 0.0


def _sev_speed(d):
    return CueSeverity.INFO if d < SPEED_INFO_THRESH else (CueSeverity.WARN if d < SPEED_WARN_THRESH else CueSeverity.ALERT)

def _sev_brake(d):
    return CueSeverity.INFO if d < BRAKE_INFO_THRESH else (CueSeverity.WARN if d < BRAKE_WARN_THRESH else CueSeverity.ALERT)

def _sev_throttle(d):
    return CueSeverity.INFO if d < THROTTLE_INFO_THRESH else (CueSeverity.WARN if d < THROTTLE_WARN_THRESH else CueSeverity.ALERT)

def _sev_line(d):
    return CueSeverity.INFO if d < LINE_INFO_THRESH else (CueSeverity.WARN if d < LINE_WARN_THRESH else CueSeverity.ALERT)
