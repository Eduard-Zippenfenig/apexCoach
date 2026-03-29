"""
ApexCoach Backend — Post-Session Analysis Engine
Computes corner-by-corner breakdown and structured coaching data.
"""
import logging
import numpy as np
from typing import List, Dict

from models import CornerAnalysis, PostAnalysisResult
from config import (
    BRAKE_DETECT_THRESH, THROTTLE_DETECT_THRESH,
    ENTRY_OFFSET_M, EXIT_OFFSET_M,
    BRAKE_SCORE_NORM, THROTTLE_SCORE_NORM, LINE_SCORE_NORM,
)

logger = logging.getLogger(__name__)


def compute_post_analysis(
    user_resampled: Dict[str, np.ndarray],
    ref_resampled: Dict[str, np.ndarray],
    segments: List[Dict],
) -> PostAnalysisResult:
    """Full post-session analysis: per-corner breakdown + overall scores."""
    distance = user_resampled["distance"]
    
    # Lap times from aligner metadata (reliable, from original frames)
    user_time = float(user_resampled.get("_lap_time_s", 
        user_resampled["timestamp_s"][-1] - user_resampled["timestamp_s"][0]))
    ref_time = float(ref_resampled.get("_lap_time_s",
        ref_resampled["timestamp_s"][-1] - ref_resampled["timestamp_s"][0]))
    total_gap = user_time - ref_time
    
    # Consistency score: based on speed variance ratio
    user_speed_std = float(np.std(user_resampled["speed_kph"]))
    ref_speed_std = float(np.std(ref_resampled["speed_kph"]))
    consistency = max(0, min(100, 100 - abs(user_speed_std - ref_speed_std) * 2))
    
    # Analyze each corner
    corner_segments = [s for s in segments if s["type"] == "corner"]
    corners = []
    
    for seg in corner_segments:
        ca = _analyze_corner(seg, user_resampled, ref_resampled, distance)
        if ca is not None:
            corners.append(ca)
    
    # Rank by time loss
    corners.sort(key=lambda c: c.estimated_time_loss_s, reverse=True)
    for i, c in enumerate(corners):
        c.coaching_priority = i + 1
    
    # Top 3 improvements
    top_3 = []
    for c in corners[:3]:
        top_3.append({
            "corner": c.corner_name,
            "issue": c.primary_issue,
            "gain_s": round(c.estimated_time_loss_s, 2),
            "suggestion": _suggestion_for_issue(c),
        })
    
    # Strongest / weakest
    strongest = corners[-1].corner_name if corners else ""
    weakest = corners[0].corner_name if corners else ""
    
    # Overall scores
    brake_deltas = [abs(c.brake_point_delta_m) for c in corners]
    throttle_deltas = [abs(c.throttle_delay_delta_m) for c in corners]
    line_devs = [c.avg_line_deviation_m for c in corners]
    
    braking_score = _compute_score(brake_deltas, BRAKE_SCORE_NORM)
    throttle_score = _compute_score(throttle_deltas, THROTTLE_SCORE_NORM)
    line_score = _compute_score(line_devs, LINE_SCORE_NORM)
    
    # Smoothness: steering variance ratio
    user_steer_std = float(np.std(user_resampled["steering"]))
    ref_steer_std = float(np.std(ref_resampled["steering"]))
    smooth_ratio = user_steer_std / max(ref_steer_std, 0.001)
    smoothness_score = max(0, min(100, int(100 - smooth_ratio * 50)))
    
    return PostAnalysisResult(
        lap_time_user_s=round(user_time, 2),
        lap_time_ref_s=round(ref_time, 2),
        total_time_gap_s=round(total_gap, 2),
        consistency_score=round(consistency, 1),
        corners=corners,
        top_3_improvements=top_3,
        strongest_section=strongest,
        weakest_section=weakest,
        overall_scores={
            "braking": braking_score,
            "line": line_score,
            "throttle": throttle_score,
            "smoothness": smoothness_score,
        },
    )


def _analyze_corner(
    seg: Dict,
    user: Dict[str, np.ndarray],
    ref: Dict[str, np.ndarray],
    distance: np.ndarray,
) -> CornerAnalysis:
    """Analyze a single corner segment."""
    d_start = seg["dist_start"]
    d_end = seg["dist_end"]
    apex_dist = seg.get("apex_dist", (d_start + d_end) / 2)
    
    start_idx = int(np.searchsorted(distance, d_start))
    end_idx = int(np.searchsorted(distance, d_end))
    end_idx = min(end_idx, len(distance) - 1)
    
    if end_idx - start_idx < 5:
        return None
    
    # Slice arrays
    d_slice = distance[start_idx:end_idx]
    
    u_speed = user["speed_kph"][start_idx:end_idx]
    r_speed = ref["speed_kph"][start_idx:end_idx]
    u_brake = user["brake"][start_idx:end_idx]
    r_brake = ref["brake"][start_idx:end_idx]
    u_throttle = user["throttle"][start_idx:end_idx]
    r_throttle = ref["throttle"][start_idx:end_idx]
    u_ct = user["cross_track"][start_idx:end_idx]
    r_ct = ref["cross_track"][start_idx:end_idx]
    u_speed_ms = user["speed_ms"][start_idx:end_idx]
    r_speed_ms = ref["speed_ms"][start_idx:end_idx]
    
    seg_len = d_end - d_start
    entry_offset = min(ENTRY_OFFSET_M, seg_len * 0.2)
    exit_offset = min(EXIT_OFFSET_M, seg_len * 0.2)
    
    # Entry speed
    entry_idx = int(np.searchsorted(d_slice, d_start + entry_offset))
    entry_idx = np.clip(entry_idx, 0, len(d_slice) - 1)
    u_entry = float(u_speed[entry_idx])
    r_entry = float(r_speed[entry_idx])
    
    # Apex speed
    u_apex_idx = int(np.argmin(u_speed))
    r_apex_idx = int(np.argmin(r_speed))
    u_apex_speed = float(u_speed[u_apex_idx])
    r_apex_speed = float(r_speed[r_apex_idx])
    
    # Exit speed
    exit_idx = int(np.searchsorted(d_slice, d_end - exit_offset))
    exit_idx = np.clip(exit_idx, 0, len(d_slice) - 1)
    u_exit = float(u_speed[exit_idx])
    r_exit = float(r_speed[exit_idx])
    
    # Brake start (search backwards from apex for brake > threshold)
    u_brake_dist = _find_brake_start(u_brake, d_slice, u_apex_idx)
    r_brake_dist = _find_brake_start(r_brake, d_slice, r_apex_idx)
    
    # Throttle pickup (search forward from apex)
    u_throttle_dist = _find_throttle_pickup(u_throttle, d_slice, u_apex_idx)
    r_throttle_dist = _find_throttle_pickup(r_throttle, d_slice, r_apex_idx)
    
    # Deltas
    brake_delta = u_brake_dist - r_brake_dist
    apex_delta = u_apex_speed - r_apex_speed
    exit_delta = u_exit - r_exit
    throttle_delay = u_throttle_dist - r_throttle_dist
    
    # Line deviation
    line_diff = np.abs(u_ct - r_ct)
    avg_line_dev = float(np.mean(line_diff))
    max_line_dev = float(np.max(line_diff))
    
    # Time loss (trapezoidal integration)
    time_loss = _compute_time_loss(u_speed_ms, r_speed_ms, d_slice)
    
    # Time loss breakdown
    apex_rel_idx = int(len(d_slice) * 0.4)
    exit_rel_idx = int(len(d_slice) * 0.7)
    
    entry_loss = _compute_time_loss(u_speed_ms[:apex_rel_idx], r_speed_ms[:apex_rel_idx], d_slice[:apex_rel_idx])
    apex_loss = _compute_time_loss(u_speed_ms[apex_rel_idx:exit_rel_idx], r_speed_ms[apex_rel_idx:exit_rel_idx], d_slice[apex_rel_idx:exit_rel_idx])
    exit_loss = _compute_time_loss(u_speed_ms[exit_rel_idx:], r_speed_ms[exit_rel_idx:], d_slice[exit_rel_idx:])
    
    # Primary issue
    issues = {
        "early_braking": abs(brake_delta) if brake_delta > 3 else 0,
        "slow_apex": abs(apex_delta) if apex_delta < -3 else 0,
        "late_throttle": abs(throttle_delay) if throttle_delay > 3 else 0,
        "line": avg_line_dev if avg_line_dev > 1.5 else 0,
    }
    primary = max(issues, key=issues.get) if max(issues.values()) > 0 else "good"
    
    return CornerAnalysis(
        corner_name=seg["name"],
        dist_start=d_start,
        dist_end=d_end,
        apex_dist=apex_dist if apex_dist else (d_start + d_end) / 2,
        user_entry_speed_kph=round(u_entry, 1),
        user_apex_speed_kph=round(u_apex_speed, 1),
        user_exit_speed_kph=round(u_exit, 1),
        user_brake_start_dist=round(u_brake_dist, 1),
        user_throttle_start_dist=round(u_throttle_dist, 1),
        ref_entry_speed_kph=round(r_entry, 1),
        ref_apex_speed_kph=round(r_apex_speed, 1),
        ref_exit_speed_kph=round(r_exit, 1),
        ref_brake_start_dist=round(r_brake_dist, 1),
        ref_throttle_start_dist=round(r_throttle_dist, 1),
        brake_point_delta_m=round(brake_delta, 1),
        apex_speed_delta_kph=round(apex_delta, 1),
        exit_speed_delta_kph=round(exit_delta, 1),
        throttle_delay_delta_m=round(throttle_delay, 1),
        avg_line_deviation_m=round(avg_line_dev, 2),
        max_line_deviation_m=round(max_line_dev, 2),
        estimated_time_loss_s=round(time_loss, 3),
        time_loss_breakdown={
            "entry": round(entry_loss, 3),
            "apex": round(apex_loss, 3),
            "exit": round(exit_loss, 3),
        },
        primary_issue=primary,
        coaching_priority=0,
    )


def _find_brake_start(brake_arr, dist_arr, apex_idx):
    """Find distance where braking begins (searching backward from apex)."""
    for i in range(min(apex_idx, len(brake_arr) - 1), -1, -1):
        if brake_arr[i] < BRAKE_DETECT_THRESH:
            return float(dist_arr[min(i + 1, len(dist_arr) - 1)])
    return float(dist_arr[0])


def _find_throttle_pickup(throttle_arr, dist_arr, apex_idx):
    """Find distance where throttle is picked up (searching forward from apex)."""
    for i in range(apex_idx, len(throttle_arr)):
        if throttle_arr[i] > THROTTLE_DETECT_THRESH:
            return float(dist_arr[i])
    return float(dist_arr[-1])


def _compute_time_loss(u_speed_ms, r_speed_ms, dist_arr):
    """Trapezoidal integration of (1/v_user - 1/v_ref) over distance."""
    if len(u_speed_ms) < 2:
        return 0.0
    u_safe = np.maximum(u_speed_ms, 0.5)
    r_safe = np.maximum(r_speed_ms, 0.5)
    dt = 1.0 / u_safe - 1.0 / r_safe
    # Use trapezoid if available (Numpy 2.0+), fall back to trapz (Numpy 1.x)
    trapz_func = getattr(np, 'trapezoid', getattr(np, 'trapz', None))
    if trapz_func is None:
        raise AttributeError("No trapezoidal integration function found in numpy")
    return float(trapz_func(dt, dist_arr))


def _compute_score(deltas, norm):
    """Compute 0-100 score from list of deltas."""
    if not deltas:
        return 80
    avg = np.mean(deltas)
    return max(0, min(100, int(100 - avg / norm * 100)))


def _suggestion_for_issue(corner: CornerAnalysis) -> str:
    """Generate a short suggestion string for a corner issue."""
    if corner.primary_issue == "early_braking":
        return f"Brake {abs(corner.brake_point_delta_m):.0f}m later and release progressively."
    elif corner.primary_issue == "slow_apex":
        return f"Carry {abs(corner.apex_speed_delta_kph):.0f} km/h more through the apex."
    elif corner.primary_issue == "late_throttle":
        return f"Pick up throttle {abs(corner.throttle_delay_delta_m):.0f}m earlier on exit."
    elif corner.primary_issue == "line":
        return f"Tighten your line — deviation avg {corner.avg_line_deviation_m:.1f}m."
    return "Maintain current approach."
