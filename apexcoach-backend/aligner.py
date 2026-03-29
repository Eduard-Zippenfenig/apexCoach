"""
ApexCoach Backend — Lap Aligner
Detects lap boundaries, isolates the best lap, and resamples both laps
onto a common 1-meter distance grid using unwrapped cumulative distance.

KEY INSIGHT: Both MCAP files start mid-lap (~1830m into the circuit).
They contain data that wraps around the start/finish line.
We must treat each file as ONE full lap across the wrap-around.
"""
import logging
import numpy as np
from scipy.interpolate import interp1d
from typing import List, Dict, Tuple

from models import TelemetryFrame
from track import TrackModel
from config import GRID_STEP_M

logger = logging.getLogger(__name__)


def detect_lap_starts(frames: List[TelemetryFrame], track: TrackModel) -> List[int]:
    """
    Find frame indices where the car crosses the start/finish line.
    Detects when lap_distance_m resets (drops from near total_lap_length back to ~0).
    """
    if len(frames) < 2:
        return [0]
    
    lap_starts = [0]
    total = track.total_lap_length
    threshold = total * 0.3
    
    for i in range(1, len(frames)):
        prev_d = frames[i - 1].lap_distance_m
        curr_d = frames[i].lap_distance_m
        if prev_d - curr_d > threshold:
            lap_starts.append(i)
    
    logger.info(f"Detected {len(lap_starts)} lap start(s) at frame indices: {lap_starts}")
    return lap_starts


def extract_best_lap(frames: List[TelemetryFrame], track: TrackModel) -> List[TelemetryFrame]:
    """
    From a file with potentially multiple laps, extract the single best lap.
    
    The MCAP files start mid-lap, so the full lap spans the entire file
    (from the start, through the S/F wrap-around, to the end).
    
    If there are 2+ complete laps, select the fastest one.
    If there's only one wrap-around (typical), use all frames as ONE lap.
    """
    lap_starts = detect_lap_starts(frames, track)
    
    # If only one wrap-around boundary detected (the common case for these files),
    # the entire file IS the lap — just use all frames
    if len(lap_starts) <= 2:
        total_time = frames[-1].timestamp_s - frames[0].timestamp_s
        logger.info(f"Single lap detected spanning full file: {total_time:.2f}s, {len(frames)} frames")
        return frames
    
    # Multiple wrap-arounds: we have multiple full laps
    # A full lap goes from one wrap-around to the next
    MIN_LAP_TIME = 30.0
    laps = []
    
    for i in range(len(lap_starts) - 1):
        # A full lap goes from boundary i to boundary i+1
        # But we also want to include the run-up TO the first boundary
        start_idx = lap_starts[i]
        end_idx = lap_starts[i + 1]
        
        lap_frames = frames[start_idx:end_idx]
        if len(lap_frames) < 100:
            continue
        
        lap_time = lap_frames[-1].timestamp_s - lap_frames[0].timestamp_s
        
        if lap_time < MIN_LAP_TIME:
            logger.info(f"  Lap {i + 1}: {len(lap_frames)} frames, {lap_time:.2f}s — SKIPPED (partial)")
            continue
        
        laps.append((start_idx, end_idx, lap_time, lap_frames))
        logger.info(f"  Lap {i + 1}: {len(lap_frames)} frames, {lap_time:.2f}s")
    
    # Also consider the last segment (from last boundary to end)
    if lap_starts[-1] < len(frames) - 100:
        last_frames = frames[lap_starts[-1]:]
        last_time = last_frames[-1].timestamp_s - last_frames[0].timestamp_s
        if last_time >= MIN_LAP_TIME:
            laps.append((lap_starts[-1], len(frames), last_time, last_frames))
            logger.info(f"  Last segment: {len(last_frames)} frames, {last_time:.2f}s")
    
    if not laps:
        logger.warning("No complete laps found — using all frames as one lap")
        return frames
    
    best = min(laps, key=lambda l: l[2])
    logger.info(f"Selected fastest lap: {best[2]:.2f}s ({len(best[3])} frames)")
    return best[3]


def _unwrap_distances(frames: List[TelemetryFrame], total_lap_length: float) -> np.ndarray:
    """
    Convert lap_distance_m values into monotonically increasing cumulative
    distances by adding total_lap_length at each wrap-around.
    """
    raw = np.array([f.lap_distance_m for f in frames])
    unwrapped = np.copy(raw)
    offset = 0.0
    
    for i in range(1, len(raw)):
        if raw[i - 1] - raw[i] > total_lap_length * 0.3:
            offset += total_lap_length
        unwrapped[i] = raw[i] + offset
    
    return unwrapped


def resample_lap(
    frames: List[TelemetryFrame],
    track: TrackModel,
    grid_step_m: float = GRID_STEP_M,
) -> Dict[str, np.ndarray]:
    """
    Resample a lap onto a uniform distance grid using unwrapped cumulative distance.
    
    The output uses WRAPPED distances (mod total_lap_length) so both laps
    can be aligned on track position.
    """
    if not frames:
        raise ValueError("No frames to resample")
    
    total = track.total_lap_length
    
    # Build unwrapped monotonically increasing distances
    unwrapped_dist = _unwrap_distances(frames, total)
    
    # Extract signal arrays (in temporal order)
    speeds_kph = np.array([f.speed_kph for f in frames])
    speeds_ms = np.array([f.speed_ms for f in frames])
    throttles = np.array([f.throttle for f in frames])
    brakes = np.array([f.brake for f in frames])
    steerings = np.array([f.steering for f in frames])
    xs = np.array([f.x for f in frames])
    ys = np.array([f.y for f in frames])
    timestamps = np.array([f.timestamp_s for f in frames])
    cross_tracks = np.array([f.cross_track_error_m for f in frames])
    axs = np.array([f.ax for f in frames])
    ays = np.array([f.ay for f in frames])
    
    # Remove duplicate unwrapped distances (keep first)
    _, unique_mask = np.unique(unwrapped_dist, return_index=True)
    unique_mask = np.sort(unique_mask)  # preserve order
    
    uw = unwrapped_dist[unique_mask]
    speeds_kph = speeds_kph[unique_mask]
    speeds_ms = speeds_ms[unique_mask]
    throttles = throttles[unique_mask]
    brakes = brakes[unique_mask]
    steerings = steerings[unique_mask]
    xs = xs[unique_mask]
    ys = ys[unique_mask]
    timestamps = timestamps[unique_mask]
    cross_tracks = cross_tracks[unique_mask]
    axs = axs[unique_mask]
    ays = ays[unique_mask]
    
    if len(uw) < 10:
        raise ValueError(f"Too few unique distance points: {len(uw)}")
    
    # Create uniform grid on unwrapped distance
    uw_grid = np.arange(uw[0], uw[-1], grid_step_m)
    
    logger.info(f"Resampling {len(uw)} points to {len(uw_grid)} grid points "
                f"(unwrapped {uw[0]:.0f}m — {uw[-1]:.0f}m)")
    
    def make_interp(values):
        return interp1d(uw, values, kind='linear',
                       bounds_error=False, fill_value='extrapolate')
    
    # Interpolate on unwrapped grid
    result_uw = {
        "speed_kph": make_interp(speeds_kph)(uw_grid),
        "speed_ms": make_interp(speeds_ms)(uw_grid),
        "throttle": make_interp(throttles)(uw_grid),
        "brake": make_interp(brakes)(uw_grid),
        "steering": make_interp(steerings)(uw_grid),
        "x": make_interp(xs)(uw_grid),
        "y": make_interp(ys)(uw_grid),
        "timestamp_s": make_interp(timestamps)(uw_grid),
        "cross_track": make_interp(cross_tracks)(uw_grid),
        "ax": make_interp(axs)(uw_grid),
        "ay": make_interp(ays)(uw_grid),
    }
    
    # Convert unwrapped grid to wrapped track distance (mod total)
    wrapped_grid = uw_grid % total
    result_uw["distance"] = wrapped_grid
    
    # Now sort by wrapped distance to get a track-position-ordered result
    sort_idx = np.argsort(wrapped_grid)
    result = {}
    for key, arr in result_uw.items():
        result[key] = arr[sort_idx]
    
    # Clamp
    result["throttle"] = np.clip(result["throttle"], 0.0, 1.0)
    result["brake"] = np.clip(result["brake"], 0.0, 1.0)
    result["speed_kph"] = np.clip(result["speed_kph"], 0.0, 400.0)
    result["speed_ms"] = np.clip(result["speed_ms"], 0.0, 120.0)
    
    return result


def align_laps(
    user_frames: List[TelemetryFrame],
    ref_frames: List[TelemetryFrame],
    track: TrackModel,
    grid_step_m: float = GRID_STEP_M,
) -> Tuple[Dict[str, np.ndarray], Dict[str, np.ndarray]]:
    """
    Resample both laps onto the same distance grid.
    Returns (user_resampled, ref_resampled).
    """
    user_resampled = resample_lap(user_frames, track, grid_step_m)
    ref_resampled = resample_lap(ref_frames, track, grid_step_m)
    
    # Find the common distance range
    u_dist = user_resampled["distance"]
    r_dist = ref_resampled["distance"]
    
    d_start = max(u_dist[0], r_dist[0])
    d_end = min(u_dist[-1], r_dist[-1])
    
    common_grid = np.arange(d_start, d_end, grid_step_m)
    
    logger.info(f"Common distance grid: {len(common_grid)} points "
                f"({d_start:.0f}m — {d_end:.0f}m)")
    
    def reinterp(resampled, new_grid):
        result = {"distance": new_grid}
        for key in resampled:
            if key == "distance":
                continue
            f = interp1d(resampled["distance"], resampled[key],
                        kind='linear', bounds_error=False, fill_value='extrapolate')
            result[key] = f(new_grid)
        return result
    
    user_aligned = reinterp(user_resampled, common_grid)
    ref_aligned = reinterp(ref_resampled, common_grid)
    
    # Clamp
    for r in [user_aligned, ref_aligned]:
        r["throttle"] = np.clip(r["throttle"], 0.0, 1.0)
        r["brake"] = np.clip(r["brake"], 0.0, 1.0)
        r["speed_kph"] = np.clip(r["speed_kph"], 0.0, 400.0)
        r["speed_ms"] = np.clip(r["speed_ms"], 0.0, 120.0)
    
    # Compute lap times from the original frames (reliable)
    user_lap_time = user_frames[-1].timestamp_s - user_frames[0].timestamp_s
    ref_lap_time = ref_frames[-1].timestamp_s - ref_frames[0].timestamp_s
    
    logger.info(f"Lap times — User: {user_lap_time:.2f}s, Ref: {ref_lap_time:.2f}s, "
                f"Gap: {user_lap_time - ref_lap_time:.2f}s")
    
    # Store lap times as metadata
    user_aligned["_lap_time_s"] = user_lap_time
    ref_aligned["_lap_time_s"] = ref_lap_time
    
    return user_aligned, ref_aligned
