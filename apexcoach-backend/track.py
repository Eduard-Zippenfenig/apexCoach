"""
ApexCoach Backend — Track Model
Loads Yas Marina circuit boundaries, builds centerline, and provides
spatial projection utilities for lap-distance computation.
"""
import json
import logging
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple

from models import TelemetryFrame

logger = logging.getLogger(__name__)


@dataclass
class TrackModel:
    left_border: np.ndarray        # shape (N, 2)
    right_border: np.ndarray       # shape (M, 2)
    centerline: np.ndarray         # shape (min(N,M), 2) — midpoint of borders
    cumulative_dist: np.ndarray    # shape (min(N,M),) — distance along centerline
    total_lap_length: float        # ~2451.0 meters


def load_track(json_path: str) -> TrackModel:
    """
    Load yas_marina_bnd.json and build centerline + cumulative distances.
    """
    with open(json_path, "r") as f:
        data = json.load(f)
    
    left = np.array(data["boundaries"]["left_border"], dtype=np.float64)
    right = np.array(data["boundaries"]["right_border"], dtype=np.float64)
    
    logger.info(f"Track boundaries: left={left.shape}, right={right.shape}")
    
    # Compute centerline from matching indices
    n = min(len(left), len(right))
    centerline = (left[:n] + right[:n]) / 2.0
    
    # Compute cumulative distance along centerline
    diffs = np.diff(centerline, axis=0)
    segment_lengths = np.sqrt(diffs[:, 0]**2 + diffs[:, 1]**2)
    cumulative_dist = np.zeros(n)
    cumulative_dist[1:] = np.cumsum(segment_lengths)
    
    total_length = cumulative_dist[-1]
    logger.info(f"Centerline: {n} points, total length: {total_length:.1f}m")
    
    return TrackModel(
        left_border=left,
        right_border=right,
        centerline=centerline,
        cumulative_dist=cumulative_dist,
        total_lap_length=total_length,
    )


def project_to_track(x: float, y: float, track: TrackModel) -> Tuple[float, float]:
    """
    Find the nearest centerline point and return (lap_distance_m, cross_track_error_m).
    
    cross_track_error_m is signed:
      positive = right of centerline
      negative = left of centerline
    """
    dx = track.centerline[:, 0] - x
    dy = track.centerline[:, 1] - y
    
    distances = np.sqrt(dx**2 + dy**2)
    nearest_idx = np.argmin(distances)
    
    lap_distance_m = track.cumulative_dist[nearest_idx]
    
    # Compute signed cross-track error using the track direction vector
    n = len(track.centerline)
    if nearest_idx < n - 1:
        dx_track = track.centerline[nearest_idx + 1, 0] - track.centerline[nearest_idx, 0]
        dy_track = track.centerline[nearest_idx + 1, 1] - track.centerline[nearest_idx, 1]
    else:
        dx_track = track.centerline[nearest_idx, 0] - track.centerline[nearest_idx - 1, 0]
        dy_track = track.centerline[nearest_idx, 1] - track.centerline[nearest_idx - 1, 1]
    
    # Cross product gives signed perpendicular distance
    dx_point = x - track.centerline[nearest_idx, 0]
    dy_point = y - track.centerline[nearest_idx, 1]
    
    # Normalize track direction
    track_len = math.sqrt(dx_track**2 + dy_track**2)
    if track_len > 0:
        cross_track = (dx_point * dy_track - dy_point * dx_track) / track_len
    else:
        cross_track = distances[nearest_idx]
    
    return lap_distance_m, cross_track


def enrich_frames(frames: List[TelemetryFrame], track: TrackModel) -> List[TelemetryFrame]:
    """
    Vectorized projection of all frames onto the track centerline.
    Sets lap_distance_m and cross_track_error_m for each frame.
    """
    if not frames:
        return frames
    
    # Build arrays for vectorized projection
    xs = np.array([f.x for f in frames])
    ys = np.array([f.y for f in frames])
    
    # Vectorized nearest-point search
    # Compute distances from each frame to each centerline point
    # For efficiency with large arrays, use chunked processing
    n_frames = len(frames)
    n_center = len(track.centerline)
    
    logger.info(f"Enriching {n_frames} frames with track position...")
    
    lap_distances = np.zeros(n_frames)
    cross_tracks = np.zeros(n_frames)
    
    # Process in chunks to avoid memory issues
    chunk_size = 1000
    for start in range(0, n_frames, chunk_size):
        end = min(start + chunk_size, n_frames)
        
        # Shape: (chunk, centerline_points)
        dx = track.centerline[:, 0][np.newaxis, :] - xs[start:end, np.newaxis]
        dy = track.centerline[:, 1][np.newaxis, :] - ys[start:end, np.newaxis]
        dists = np.sqrt(dx**2 + dy**2)
        
        nearest_indices = np.argmin(dists, axis=1)
        lap_distances[start:end] = track.cumulative_dist[nearest_indices]
        
        # Compute cross-track errors
        for i, idx in enumerate(nearest_indices):
            fi = start + i
            if idx < n_center - 1:
                dx_t = track.centerline[idx + 1, 0] - track.centerline[idx, 0]
                dy_t = track.centerline[idx + 1, 1] - track.centerline[idx, 1]
            else:
                dx_t = track.centerline[idx, 0] - track.centerline[idx - 1, 0]
                dy_t = track.centerline[idx, 1] - track.centerline[idx - 1, 1]
            
            dx_p = xs[fi] - track.centerline[idx, 0]
            dy_p = ys[fi] - track.centerline[idx, 1]
            
            t_len = np.sqrt(dx_t**2 + dy_t**2)
            if t_len > 0:
                cross_tracks[fi] = (dx_p * dy_t - dy_p * dx_t) / t_len
            else:
                cross_tracks[fi] = dists[i, idx]
    
    # Assign to frames
    for i, frame in enumerate(frames):
        frame.lap_distance_m = float(lap_distances[i])
        frame.cross_track_error_m = float(cross_tracks[i])
    
    logger.info(f"Enrichment complete. Distance range: {lap_distances.min():.1f} — {lap_distances.max():.1f}m")
    
    return frames


# Need math for project_to_track
import math
