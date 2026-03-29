"""Quick debug script to understand lap boundaries in both MCAP files."""
import sys
import numpy as np
sys.path.insert(0, '.')

from parse_mcap import parse_mcap
from track import load_track, enrich_frames
from config import GOOD_LAP_PATH, FAST_LAP_PATH, TRACK_JSON_PATH

track = load_track(TRACK_JSON_PATH)

for label, path in [("GOOD LAP", GOOD_LAP_PATH), ("FAST LAPS", FAST_LAP_PATH)]:
    print(f"\n{'='*60}")
    print(f"  {label}: {path}")
    print(f"{'='*60}")
    
    frames = parse_mcap(path)
    frames = enrich_frames(frames, track)
    
    duration = frames[-1].timestamp_s - frames[0].timestamp_s
    print(f"  Total frames: {len(frames)}")
    print(f"  Duration: {duration:.2f}s")
    
    # Look at distance profile
    dists = np.array([f.lap_distance_m for f in frames])
    times = np.array([f.timestamp_s for f in frames])
    times -= times[0]
    
    # Find potential wrap-arounds / resets
    print(f"\n  Distance range: {dists.min():.1f} — {dists.max():.1f}m")
    
    # Detect big drops in distance (lap boundary crossings)
    total = track.total_lap_length
    drops = []
    for i in range(1, len(dists)):
        diff = dists[i-1] - dists[i]
        if diff > total * 0.3:
            drops.append((i, times[i], dists[i-1], dists[i], diff))
    
    print(f"\n  Lap boundary crossings (distance drops > {total*0.3:.0f}m):")
    for idx, t, d_before, d_after, drop in drops:
        print(f"    Frame {idx}: t={t:.2f}s, dist {d_before:.1f} → {d_after:.1f} (drop={drop:.1f}m)")
    
    # Show lap segments
    boundaries = [0] + [d[0] for d in drops] + [len(frames)]
    print(f"\n  Laps:")
    for i in range(len(boundaries)-1):
        start = boundaries[i]
        end = boundaries[i+1]
        lap_frames = frames[start:end]
        lap_time = lap_frames[-1].timestamp_s - lap_frames[0].timestamp_s
        start_dist = lap_frames[0].lap_distance_m
        end_dist = lap_frames[-1].lap_distance_m
        print(f"    Lap {i+1}: frames {start}—{end} ({len(lap_frames)} fr), "
              f"time={lap_time:.2f}s, dist {start_dist:.1f}—{end_dist:.1f}m")
        
        # Sample some distances at key time points
        for pct in [0, 0.25, 0.5, 0.75, 1.0]:
            idx = start + int((end-start-1) * pct)
            f = frames[idx]
            print(f"      @{pct*100:.0f}%: t={f.timestamp_s - frames[start].timestamp_s:.2f}s, "
                  f"dist={f.lap_distance_m:.1f}m, speed={f.speed_kph:.1f}kph, "
                  f"pos=({f.x:.1f}, {f.y:.1f})")
