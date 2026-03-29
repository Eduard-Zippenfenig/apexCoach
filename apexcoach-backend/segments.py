"""
ApexCoach Backend — Segment & Corner Detector
Labels each distance point with a segment type from reference lap telemetry.
Uses lateral acceleration (ay) as the primary corner signal.
"""
import logging
import numpy as np
from typing import List, Dict

from config import (
    SEGMENT_SMOOTH_WINDOW,
    MIN_SEGMENT_LENGTH_M,
    AY_STRAIGHT_THRESH,
    AY_CORNER_THRESH,
    BRAKE_THRESH,
    THROTTLE_STRAIGHT_THRESH,
    THROTTLE_ACCEL_THRESH,
)

logger = logging.getLogger(__name__)


def detect_segments_from_telemetry(
    ref_resampled: Dict[str, np.ndarray]
) -> List[Dict]:
    """
    Detect segment types from the REFERENCE lap telemetry automatically.

    Uses lateral acceleration (ay), brake, and throttle signals to classify
    each distance point as: straight / braking / corner / acceleration.

    Thresholds (from config, in g):
      |ay| < AY_STRAIGHT_THRESH → straight candidate
      |ay| > AY_CORNER_THRESH   → corner candidate
      brake > BRAKE_THRESH      → braking zone
    """
    distance = ref_resampled["distance"]
    ay = ref_resampled.get("ay", np.zeros(len(distance)))
    brake = ref_resampled["brake"]
    throttle = ref_resampled["throttle"]
    speed_kph = ref_resampled["speed_kph"]

    n = len(distance)

    # Smooth signals with rolling window
    window = min(SEGMENT_SMOOTH_WINDOW, n // 4)
    if window < 3:
        window = 3

    ay_smooth = _rolling_mean(np.abs(ay), window)
    brake_smooth = _rolling_mean(brake, window)
    throttle_smooth = _rolling_mean(throttle, window)

    # Label each point
    labels = []
    for i in range(n):
        ay_val = ay_smooth[i]
        br_val = brake_smooth[i]
        th_val = throttle_smooth[i]

        if br_val > BRAKE_THRESH:
            labels.append("braking")
        elif ay_val > AY_CORNER_THRESH:
            labels.append("corner")
        elif ay_val < AY_STRAIGHT_THRESH and th_val > THROTTLE_STRAIGHT_THRESH:
            labels.append("straight")
        elif ay_val < AY_STRAIGHT_THRESH and th_val > THROTTLE_ACCEL_THRESH:
            labels.append("acceleration")
        elif ay_val > AY_STRAIGHT_THRESH:
            # Between straight and corner threshold — transitional
            if th_val > THROTTLE_ACCEL_THRESH and br_val < BRAKE_THRESH:
                labels.append("acceleration")
            else:
                labels.append("corner")
        else:
            labels.append("straight")

    # Group consecutive same-type points into segments
    raw_segments = _group_segments(labels, distance)

    # Filter out segments shorter than MIN_SEGMENT_LENGTH_M
    filtered = [s for s in raw_segments if s["length"] >= MIN_SEGMENT_LENGTH_M]

    # Merge adjacent segments of same type
    merged = _merge_adjacent(filtered)

    # Label corner segments sequentially, find apex
    corner_count = 0
    for seg in merged:
        if seg["type"] == "corner":
            corner_count += 1
            seg["name"] = f"Turn {corner_count}"

            # Find apex: minimum speed within segment
            start_idx = int(np.searchsorted(distance, seg["dist_start"]))
            end_idx = int(np.searchsorted(distance, seg["dist_end"]))
            end_idx = min(end_idx, n - 1)

            if start_idx < end_idx:
                segment_speeds = speed_kph[start_idx:end_idx]
                apex_local_idx = np.argmin(segment_speeds)
                seg["apex_dist"] = float(distance[start_idx + apex_local_idx])
            else:
                seg["apex_dist"] = (seg["dist_start"] + seg["dist_end"]) / 2.0
        else:
            seg["name"] = seg["type"].capitalize()
            seg["apex_dist"] = None

    logger.info(f"Detected {len(merged)} segments ({corner_count} corners)")
    for seg in merged:
        logger.info(f"  {seg['name']:>12s} [{seg['type']:>12s}]: "
                    f"{seg['dist_start']:.0f}m — {seg['dist_end']:.0f}m "
                    f"({seg['length']:.0f}m)")

    return merged


def _rolling_mean(arr: np.ndarray, window: int) -> np.ndarray:
    """Compute rolling mean with edge padding."""
    kernel = np.ones(window) / window
    padded = np.pad(arr, (window // 2, window // 2), mode='edge')
    return np.convolve(padded, kernel, mode='valid')[:len(arr)]


def _group_segments(labels: List[str], distance: np.ndarray) -> List[Dict]:
    """Group consecutive same-type labels into segments."""
    segments = []
    current_type = labels[0]
    start_dist = distance[0]

    for i in range(1, len(labels)):
        if labels[i] != current_type:
            segments.append({
                "type": current_type,
                "dist_start": float(start_dist),
                "dist_end": float(distance[i - 1]),
                "length": float(distance[i - 1] - start_dist),
            })
            current_type = labels[i]
            start_dist = distance[i]

    # Final segment
    segments.append({
        "type": current_type,
        "dist_start": float(start_dist),
        "dist_end": float(distance[-1]),
        "length": float(distance[-1] - start_dist),
    })

    return segments


def _merge_adjacent(segments: List[Dict]) -> List[Dict]:
    """Merge adjacent segments of the same type."""
    if not segments:
        return []

    merged = [segments[0].copy()]
    for seg in segments[1:]:
        if seg["type"] == merged[-1]["type"]:
            merged[-1]["dist_end"] = seg["dist_end"]
            merged[-1]["length"] = merged[-1]["dist_end"] - merged[-1]["dist_start"]
        else:
            merged.append(seg.copy())

    return merged


def get_segment_at_distance(distance_m: float, segments: List[Dict]) -> Dict:
    """Find which segment contains the given distance."""
    for seg in segments:
        if seg["dist_start"] <= distance_m <= seg["dist_end"]:
            return seg
    # Default to nearest
    if segments:
        dists = [abs(distance_m - (s["dist_start"] + s["dist_end"]) / 2) for s in segments]
        return segments[int(np.argmin(dists))]
    return {"name": "Unknown", "type": "straight", "dist_start": 0, "dist_end": 0}
