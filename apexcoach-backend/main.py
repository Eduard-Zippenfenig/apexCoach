"""
ApexCoach Backend — FastAPI Application
REST + SSE API serving telemetry analysis and live coaching.
"""
import json
import asyncio
import logging
import time
import threading
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config import (
    GOOD_LAP_PATH, FAST_LAP_PATH, TRACK_JSON_PATH,
    SSE_FRAME_INTERVAL, DEFAULT_PLAYBACK_SPEED,
)
from parse_mcap import parse_mcap
from track import load_track, enrich_frames
from aligner import extract_best_lap, align_laps, detect_lap_starts
from segments import detect_segments_from_telemetry
from live_coach import compute_live_cue
from post_analysis import compute_post_analysis
from report_generator import generate_coaching_report
import users_db
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("apexcoach")

# ─── Global State ─────────────────────────────────────────────
_state = {}
_cached_report = None

def _load_session(good_path: str, fast_path: str, track_path: str):
    global _cached_report
    _cached_report = None
    """Load and process all data. Called at startup or via /session/load."""
    t0 = time.time()

    # 1. Load track
    logger.info("Loading track...")
    track = load_track(track_path)

    # 2. Parse MCAP files
    logger.info("Parsing good lap MCAP...")
    good_frames = parse_mcap(good_path)
    logger.info("Parsing fast laps MCAP...")
    fast_frames = parse_mcap(fast_path)

    # 3. Enrich with track distance
    logger.info("Enriching frames with track position...")
    good_frames = enrich_frames(good_frames, track)
    fast_frames = enrich_frames(fast_frames, track)

    # 4. Extract best lap from fast file
    logger.info("Extracting best lap...")
    ref_frames = extract_best_lap(fast_frames, track)

    # 5. Resample to 1m grid and align
    logger.info("Aligning laps...")
    user_resampled, ref_resampled = align_laps(good_frames, ref_frames, track)

    # 6. Detect segments
    logger.info("Detecting segments...")
    segments = detect_segments_from_telemetry(ref_resampled)

    # 7. Pre-compute post analysis
    logger.info("Computing post analysis...")
    analysis = compute_post_analysis(user_resampled, ref_resampled, segments)

    elapsed = time.time() - t0
    logger.info(f"Session loaded in {elapsed:.1f}s")

    _state.update({
        "track": track,
        "user_frames": good_frames,
        "ref_frames": ref_frames,
        "user_resampled": user_resampled,
        "ref_resampled": ref_resampled,
        "segments": segments,
        "analysis": analysis,
        "loaded": True,
    })

    return {
        "status": "loaded",
        "good_lap_frames": len(good_frames),
        "ref_lap_frames": len(ref_frames),
        "ref_lap_time_s": analysis.lap_time_ref_s,
        "good_lap_time_s": analysis.lap_time_user_s,
        "time_gap_s": analysis.total_time_gap_s,
        "segments_detected": len([s for s in segments if s["type"] == "corner"]),
        "track_length_m": track.total_lap_length,
        "load_time_s": round(elapsed, 1),
    }


def reassemble_files():
    """Bypass GitHub 100MB limit by reassembling split parts."""
    import glob
    import os
    for base in [GOOD_LAP_PATH, FAST_LAP_PATH]:
        if not os.path.exists(base):
            parts = sorted(glob.glob(f"{base}.part_*"))
            if parts:
                logger.info(f"Reassembling {base} from {len(parts)} parts...")
                with open(base, 'wb') as outfile:
                    for p in parts:
                        with open(p, 'rb') as infile:
                            outfile.write(infile.read())
                logger.info(f"Successfully reassembled {base}")


# ─── Lifespan ─────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load everything at startup."""
    try:
        reassemble_files()
        users_db.init_db()
        users_db.seed_demo_data()
        
        # Run heavy loading in a background thread to prevent blocking FastAPI port binding
        def background_load():
            try:
                _load_session(GOOD_LAP_PATH, FAST_LAP_PATH, TRACK_JSON_PATH)
            except Exception as e:
                logger.error(f"Failed to load session in background: {e}")
                
        threading.Thread(target=background_load, daemon=True).start()
    except Exception as e:
        logger.error(f"Failed to load session at startup: {e}")
        logger.info("Server starting without data — use POST /session/load")
        _state["loaded"] = False
    yield


# ─── App ──────────────────────────────────────────────────────

app = FastAPI(
    title="ApexCoach Backend",
    version="1.0.0",
    description="Motorsport AI coaching engine — Yas Marina circuit analysis",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Helper to convert numpy arrays to lists ─────────────────

def np_to_list(arr):
    """Convert numpy array to Python list for JSON serialization."""
    if isinstance(arr, np.ndarray):
        return arr.tolist()
    return arr


# ─── Pydantic Models ──────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class SessionCreate(BaseModel):
    track: str
    lap_time_s: float
    ref_lap_time_s: float
    gap_s: float
    scores: dict = {}
    summary: str = ""
    corners: list = []
    coaching_report: dict = {}


# ─── Endpoints ────────────────────────────────────────────────

@app.post("/users/register")
async def register_user(user: UserCreate):
    new_user = users_db.create_user(user.name, user.email, user.password)
    if not new_user:
        return JSONResponse(status_code=400, content={"detail": "Email already registered"})
    return new_user

@app.post("/users/login")
async def login_user(user: UserLogin):
    auth_user = users_db.authenticate_user(user.email, user.password)
    if not auth_user:
        return JSONResponse(status_code=401, content={"detail": "Invalid credentials"})
    return auth_user

@app.get("/users/{user_id}")
async def get_user_profile(user_id: int):
    user = users_db.get_user(user_id)
    if not user:
        return JSONResponse(status_code=404, content={"detail": "User not found"})
    return user

@app.post("/users/{user_id}/sessions")
async def create_user_session(user_id: int, session: SessionCreate):
    session_id = users_db.save_session(
        user_id, session.track, session.lap_time_s, session.ref_lap_time_s,
        session.gap_s, session.scores, session.summary, session.corners,
        session.coaching_report
    )
    return {"message": "Session saved", "session_id": session_id}

@app.get("/users/{user_id}/sessions")
async def get_sessions(user_id: int):
    sessions = users_db.get_user_sessions(user_id)
    return sessions

@app.get("/session/export")
async def export_session(user_id: int = Query(None), carBrand: str = Query(None), horsepower: str = Query(None)):
    """Export the current live session. Auto-saves to user account if user_id matches."""
    if not _state.get("loaded"):
        return JSONResponse(status_code=503, content={"error": "Data not loaded"})
    
    analysis = _state["analysis"]
    
    global _cached_report
    if _cached_report is None:
        _cached_report = generate_coaching_report(analysis, "intermediate", "Driver")
    
    report = _cached_report
    
    corners_data = []
    for c in analysis.corners:
        corners_data.append({
            "corner_name": c.corner_name,
            "estimated_time_loss_s": c.estimated_time_loss_s,
            "primary_issue": c.primary_issue
        })
        
    session_data = {
        "track": "Yas Marina Circuit",
        "lap_time_s": analysis.lap_time_user_s,
        "ref_lap_time_s": analysis.lap_time_ref_s,
        "gap_s": analysis.total_time_gap_s,
        "scores": analysis.overall_scores,
        "summary": "Session complete. Data imported from tablet.",
        "corners": corners_data,
        "coaching_report": report,
        "car": carBrand or "Unknown Vehicle",
        "horsepower": horsepower or "Unknown"
    }
    
    if user_id:
        users_db.save_session(
            user_id, session_data["track"], session_data["lap_time_s"],
            session_data["ref_lap_time_s"], session_data["gap_s"],
            session_data["scores"], session_data["summary"],
            session_data["corners"], session_data["coaching_report"]
        )
        
    return session_data

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "files_loaded": {
            "good_lap": _state.get("loaded", False),
            "fast_lap": _state.get("loaded", False),
        },
        "track_loaded": _state.get("loaded", False),
    }


@app.post("/session/load")
async def session_load(body: dict = None):
    """Load and process MCAP files."""
    good_path = GOOD_LAP_PATH
    fast_path = FAST_LAP_PATH
    track_path = TRACK_JSON_PATH

    if body:
        good_path = body.get("good_lap_path", good_path)
        fast_path = body.get("fast_lap_path", fast_path)
        track_path = body.get("track_path", track_path)

    try:
        result = _load_session(good_path, fast_path, track_path)
        return result
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )


@app.get("/track")
async def get_track():
    """Return track boundary and centerline data for map rendering."""
    if not _state.get("loaded"):
        return JSONResponse(status_code=503, content={"error": "Data not loaded"})

    track = _state["track"]
    segments = _state["segments"]

    return {
        "map_name": "yas_marina",
        "track_length_m": track.total_lap_length,
        "left_border": track.left_border.tolist(),
        "right_border": track.right_border.tolist(),
        "centerline": track.centerline.tolist(),
        "segments": segments,
    }


@app.get("/reference/trace")
async def get_reference_trace():
    """Return the reference lap's resampled trace."""
    if not _state.get("loaded"):
        return JSONResponse(status_code=503, content={"error": "Data not loaded"})

    ref = _state["ref_resampled"]
    analysis = _state["analysis"]

    return {
        "distance": np_to_list(ref["distance"]),
        "speed_kph": np_to_list(ref["speed_kph"]),
        "throttle": np_to_list(ref["throttle"]),
        "brake": np_to_list(ref["brake"]),
        "x": np_to_list(ref["x"]),
        "y": np_to_list(ref["y"]),
        "lap_time_s": analysis.lap_time_ref_s,
    }


@app.get("/user/trace")
async def get_user_trace():
    """Return the user (good) lap's resampled trace."""
    if not _state.get("loaded"):
        return JSONResponse(status_code=503, content={"error": "Data not loaded"})

    user = _state["user_resampled"]
    analysis = _state["analysis"]

    return {
        "distance": np_to_list(user["distance"]),
        "speed_kph": np_to_list(user["speed_kph"]),
        "throttle": np_to_list(user["throttle"]),
        "brake": np_to_list(user["brake"]),
        "x": np_to_list(user["x"]),
        "y": np_to_list(user["y"]),
        "lap_time_s": analysis.lap_time_user_s,
    }


@app.get("/live/stream")
async def live_stream(
    playback_speed: float = Query(DEFAULT_PLAYBACK_SPEED, ge=0.1, le=20.0),
    driver_level: str = Query("intermediate"),
):
    """SSE stream — replays user lap with live coaching cues."""
    if not _state.get("loaded"):
        return JSONResponse(status_code=503, content={"error": "Data not loaded"})

    user_frames = _state["user_frames"]
    ref_resampled = _state["ref_resampled"]
    segments = _state["segments"]

    async def event_generator():
        start_time = user_frames[0].timestamp_s

        # Downsample to ~10Hz for SSE (every 10th frame from 100Hz)
        step = max(1, int(10 / playback_speed))

        for i in range(0, len(user_frames), step):
            frame = user_frames[i]
            elapsed = frame.timestamp_s - start_time

            # Compute live coaching cue
            cue = compute_live_cue(
                current_distance_m=frame.lap_distance_m,
                user_speed_kph=frame.speed_kph,
                user_throttle=frame.throttle,
                user_brake=frame.brake,
                user_steering=frame.steering,
                user_cross_track=frame.cross_track_error_m,
                ref_resampled=ref_resampled,
                segments=segments,
            )

            # Get reference speed at this distance
            ref_dist = ref_resampled["distance"]
            ref_idx = int(np.searchsorted(ref_dist, frame.lap_distance_m))
            ref_idx = np.clip(ref_idx, 0, len(ref_dist) - 1)
            ref_speed = float(ref_resampled["speed_kph"][ref_idx])

            # Estimate cumulative time delta
            ref_ts = ref_resampled["timestamp_s"]
            ref_time_at_dist = float(ref_ts[ref_idx] - ref_ts[0])
            delta_time = elapsed - ref_time_at_dist

            data = {
                "elapsed_s": round(elapsed, 2),
                "lap_distance_m": round(frame.lap_distance_m, 1),
                "speed_kph": round(frame.speed_kph, 1),
                "throttle": round(frame.throttle, 3),
                "brake": round(frame.brake, 3),
                "steering": round(frame.steering, 4),
                "x": round(frame.x, 2),
                "y": round(frame.y, 2),
                "gear": frame.gear,
                "segment": cue.segment_name,
                "cue": {
                    "type": cue.cue_type.value,
                    "severity": cue.severity.value,
                    "short_message": cue.short_message,
                    "audio_message": cue.audio_message,
                    "delta_speed_kph": cue.delta_speed_kph,
                    "delta_brake_m": cue.delta_brake_m,
                    "time_loss_estimate_s": cue.time_loss_estimate_s,
                },
                "ref_speed_kph": round(ref_speed, 1),
                "delta_speed_kph": round(frame.speed_kph - ref_speed, 1),
                "delta_time_s": round(delta_time, 2),
            }

            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep((SSE_FRAME_INTERVAL * step) / playback_speed)

        # End event
        yield f"data: {json.dumps({'event': 'end'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/analysis/post")
async def get_post_analysis(
    driver_level: str = Query("intermediate"),
    driver_name: str = Query("Driver"),
    force_reload: bool = Query(False),
):
    """Return full post-session analysis with coaching report."""
    if not _state.get("loaded"):
        return JSONResponse(status_code=503, content={"error": "Data not loaded"})

    analysis = _state["analysis"]
    
    global _cached_report
    if force_reload or _cached_report is None:
        _cached_report = generate_coaching_report(analysis, driver_level, driver_name)
    
    report = _cached_report

    corners_data = []
    for c in analysis.corners:
        corners_data.append({
            "corner_name": c.corner_name,
            "coaching_priority": c.coaching_priority,
            "user_entry_speed_kph": c.user_entry_speed_kph,
            "ref_entry_speed_kph": c.ref_entry_speed_kph,
            "user_apex_speed_kph": c.user_apex_speed_kph,
            "ref_apex_speed_kph": c.ref_apex_speed_kph,
            "user_exit_speed_kph": c.user_exit_speed_kph,
            "ref_exit_speed_kph": c.ref_exit_speed_kph,
            "brake_point_delta_m": c.brake_point_delta_m,
            "throttle_delay_delta_m": c.throttle_delay_delta_m,
            "avg_line_deviation_m": c.avg_line_deviation_m,
            "estimated_time_loss_s": c.estimated_time_loss_s,
            "primary_issue": c.primary_issue,
            "time_loss_breakdown": c.time_loss_breakdown,
        })

    return {
        "session": {
            "user_lap_time_s": analysis.lap_time_user_s,
            "ref_lap_time_s": analysis.lap_time_ref_s,
            "total_time_gap_s": analysis.total_time_gap_s,
            "consistency_score": analysis.consistency_score,
        },
        "overall_scores": analysis.overall_scores,
        "top_3_improvements": analysis.top_3_improvements,
        "strongest_section": analysis.strongest_section,
        "weakest_section": analysis.weakest_section,
        "corners": corners_data,
        "coaching_report": report,
    }


@app.get("/analysis/speed-trace")
async def get_speed_trace():
    """Return speed traces of both laps on a common distance axis."""
    if not _state.get("loaded"):
        return JSONResponse(status_code=503, content={"error": "Data not loaded"})

    user = _state["user_resampled"]
    ref = _state["ref_resampled"]
    segments = _state["segments"]

    speed_delta = user["speed_kph"] - ref["speed_kph"]

    return {
        "distance_m": np_to_list(user["distance"]),
        "user_speed_kph": np_to_list(user["speed_kph"]),
        "ref_speed_kph": np_to_list(ref["speed_kph"]),
        "speed_delta_kph": np_to_list(speed_delta),
        "user_throttle": np_to_list(user["throttle"]),
        "ref_throttle": np_to_list(ref["throttle"]),
        "user_brake": np_to_list(user["brake"]),
        "ref_brake": np_to_list(ref["brake"]),
        "segments": segments,
    }


@app.get("/analysis/time-loss-map")
async def get_time_loss_map():
    """Return per-meter time loss for track heatmap rendering."""
    if not _state.get("loaded"):
        return JSONResponse(status_code=503, content={"error": "Data not loaded"})

    user = _state["user_resampled"]
    ref = _state["ref_resampled"]

    u_speed_ms = np.maximum(user["speed_ms"], 0.5)
    r_speed_ms = np.maximum(ref["speed_ms"], 0.5)

    # Time loss per meter: positive = user losing time
    time_loss_per_m = 1.0 / u_speed_ms - 1.0 / r_speed_ms
    cumulative_loss = np.cumsum(time_loss_per_m)

    return {
        "distance_m": np_to_list(user["distance"]),
        "time_loss_per_meter_s": np_to_list(np.round(time_loss_per_m, 6)),
        "x": np_to_list(user["x"]),
        "y": np_to_list(user["y"]),
        "cumulative_time_loss_s": np_to_list(np.round(cumulative_loss, 4)),
    }


# ─── Run ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
