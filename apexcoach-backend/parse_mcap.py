"""
ApexCoach Backend — MCAP Parser
Extracts telemetry frames from StateEstimation messages in MCAP files.
"""
import math
import logging
from typing import List

from mcap.reader import make_reader
from mcap_ros2.decoder import DecoderFactory

from models import TelemetryFrame
from config import STATE_ESTIMATION_TOPIC

logger = logging.getLogger(__name__)


def parse_mcap(filepath: str) -> List[TelemetryFrame]:
    """
    Open an MCAP file and extract all StateEstimation messages
    from the /constructor0/state_estimation topic.
    
    Returns a list of TelemetryFrame sorted by timestamp ascending.
    """
    frames: List[TelemetryFrame] = []
    
    try:
        frames = _parse_with_ros2_decoder(filepath)
    except Exception as e:
        logger.warning(f"ROS2 decoder failed: {e}. Trying raw approach...")
        frames = _parse_raw_fallback(filepath)
    
    if not frames:
        raise RuntimeError(f"No frames extracted from {filepath}")
    
    # Sort by timestamp
    frames.sort(key=lambda f: f.timestamp_ns)
    
    logger.info(f"Parsed {len(frames)} frames from {filepath}")
    logger.info(f"  Time range: {frames[0].timestamp_s:.2f}s — {frames[-1].timestamp_s:.2f}s")
    logger.info(f"  Duration: {frames[-1].timestamp_s - frames[0].timestamp_s:.2f}s")
    
    return frames


def _parse_with_ros2_decoder(filepath: str) -> List[TelemetryFrame]:
    """Parse using mcap-ros2-support decoder."""
    frames: List[TelemetryFrame] = []
    
    with open(filepath, "rb") as f:
        reader = make_reader(f, decoder_factories=[DecoderFactory()])
        
        for schema, channel, message, decoded_msg in reader.iter_decoded_messages(
            topics=[STATE_ESTIMATION_TOPIC]
        ):
            try:
                frame = _msg_to_frame(message, decoded_msg)
                frames.append(frame)
            except Exception as e:
                logger.debug(f"Skipping message at {message.log_time}: {e}")
                continue
    
    return frames


def _msg_to_frame(message, msg) -> TelemetryFrame:
    """
    Convert a decoded StateEstimation ROS2 message to TelemetryFrame.
    
    Actual field mapping from sd_localization_msgs/StateEstimation.msg:
      x_m, y_m, z_m          → position
      vx_mps, vy_mps          → velocity components
      v_mps                   → total speed
      gas                     → throttle (0–1)
      brake                   → brake (0–1)
      delta_wheel_rad         → steering angle
      gear                    → gear (float64, cast to int)
      ax_mps2, ay_mps2        → accelerations
      yaw_rad                 → heading
    """
    ts_ns = message.log_time  # nanoseconds
    ts_s = ts_ns / 1e9
    
    x = float(msg.x_m)
    y = float(msg.y_m)
    z = float(msg.z_m)
    vx = float(msg.vx_mps)
    vy = float(msg.vy_mps)
    
    # Use pre-computed speed from the message
    speed_ms = float(msg.v_mps)
    if speed_ms <= 0:
        speed_ms = math.sqrt(vx**2 + vy**2)
    
    speed_kph = speed_ms * 3.6
    
    throttle = float(msg.gas)
    brake_raw = float(msg.brake)
    # Brake is pressure in Pa (~0-4M), normalize to 0-1
    BRAKE_MAX_PA = 4_000_000.0
    brake_val = min(max(brake_raw / BRAKE_MAX_PA, 0.0), 1.0)
    steering = float(msg.delta_wheel_rad)
    gear = int(msg.gear)
    
    ax = float(msg.ax_mps2)
    ay = float(msg.ay_mps2)
    yaw = float(msg.yaw_rad)
    
    return TelemetryFrame(
        timestamp_ns=ts_ns,
        timestamp_s=ts_s,
        x=x, y=y, z=z,
        vx=vx, vy=vy,
        speed_ms=speed_ms,
        speed_kph=speed_kph,
        throttle=throttle,
        brake=brake_val,
        steering=steering,
        gear=gear,
        ax=ax,
        ay=ay,
        yaw=yaw,
    )


def _parse_raw_fallback(filepath: str) -> List[TelemetryFrame]:
    """
    Fallback: iterate all messages and try attribute access patterns,
    handling cases where the ROS2 decoder can't resolve custom types.
    """
    frames: List[TelemetryFrame] = []
    
    with open(filepath, "rb") as f:
        reader = make_reader(f)
        
        for schema, channel, message in reader.iter_messages(
            topics=[STATE_ESTIMATION_TOPIC]
        ):
            try:
                # Try to manually decode CDR bytes
                frame = _decode_cdr_state_estimation(message)
                if frame is not None:
                    frames.append(frame)
            except Exception as e:
                logger.debug(f"Raw decode failed: {e}")
                continue
    
    return frames


def _decode_cdr_state_estimation(message) -> TelemetryFrame:
    """
    Manual CDR byte parsing for StateEstimation message.
    Based on the .msg definition field order.
    """
    import struct
    
    data = message.data
    ts_ns = message.log_time
    ts_s = ts_ns / 1e9
    
    # CDR encoding: 4 bytes header, then fields in order
    # std_msgs/Header: 4 bytes (sec) + 4 bytes (nanosec) + string (frame_id)
    offset = 4  # skip CDR encapsulation header
    
    # Header - sec (uint32), nanosec (uint32)
    header_sec = struct.unpack_from('<I', data, offset)[0]
    offset += 4
    header_nanosec = struct.unpack_from('<I', data, offset)[0]
    offset += 4
    
    # frame_id string: 4 bytes length + string + padding
    str_len = struct.unpack_from('<I', data, offset)[0]
    offset += 4 + str_len
    # Align to 4 bytes
    offset = (offset + 3) & ~3
    
    # Now the StateEstimation fields (all float64 unless noted):
    # int32 se_status, int32 se_state
    se_status = struct.unpack_from('<i', data, offset)[0]; offset += 4
    se_state = struct.unpack_from('<i', data, offset)[0]; offset += 4
    
    # Align to 8 bytes for float64
    offset = (offset + 7) & ~7
    
    # float64 fields in order from .msg
    def read_f64():
        nonlocal offset
        val = struct.unpack_from('<d', data, offset)[0]
        offset += 8
        return val
    
    x_m = read_f64()
    y_m = read_f64()
    z_m = read_f64()
    roll_rad = read_f64()
    pitch_rad = read_f64()
    yaw_rad = read_f64()
    
    # float64[3] pos_accuracy
    pos_acc = [read_f64() for _ in range(3)]
    # float64[3] vel_accuracy
    vel_acc = [read_f64() for _ in range(3)]
    
    wx = read_f64()
    wy = read_f64()
    wz = read_f64()
    vx_mps = read_f64()
    vy_mps = read_f64()
    vz_mps = read_f64()
    
    omega_w_fl = read_f64()
    omega_w_fr = read_f64()
    omega_w_rl = read_f64()
    omega_w_rr = read_f64()
    
    v_mps = read_f64()
    v_raw_mps = read_f64()
    beta_rad = read_f64()
    ax_mps2 = read_f64()
    ay_mps2 = read_f64()
    az_mps2 = read_f64()
    
    # bool valid_imu_b (1 byte + 7 padding to align next float64)
    valid_imu = struct.unpack_from('<?', data, offset)[0]; offset += 1
    offset = (offset + 7) & ~7
    
    yaw_vel_rad = read_f64()
    kappa = read_f64()
    dbeta = read_f64()
    ddyaw = read_f64()
    ax_vel = read_f64()
    ay_vel = read_f64()
    
    lambda_fl = read_f64()
    lambda_fr = read_f64()
    lambda_rl = read_f64()
    lambda_rr = read_f64()
    
    # bool valid_wheelsspeeds_b
    valid_ws = struct.unpack_from('<?', data, offset)[0]; offset += 1
    offset = (offset + 7) & ~7
    
    alpha_fl = read_f64()
    alpha_fr = read_f64()
    alpha_rl = read_f64()
    alpha_rr = read_f64()
    diff_fr_alpha = read_f64()
    delta_wheel_rad = read_f64()
    timestamp_field = read_f64()
    gas = read_f64()
    brake_raw = read_f64()
    # Brake is pressure in Pa (~0-4M), normalize to 0-1
    BRAKE_MAX_PA = 4_000_000.0
    brake_val = min(max(brake_raw / BRAKE_MAX_PA, 0.0), 1.0)
    clutch = read_f64()
    gear = read_f64()
    
    speed_ms = v_mps if v_mps > 0 else math.sqrt(vx_mps**2 + vy_mps**2)
    
    return TelemetryFrame(
        timestamp_ns=ts_ns,
        timestamp_s=ts_s,
        x=x_m, y=y_m, z=z_m,
        vx=vx_mps, vy=vy_mps,
        speed_ms=speed_ms,
        speed_kph=speed_ms * 3.6,
        throttle=gas,
        brake=brake_val,
        steering=delta_wheel_rad,
        gear=int(gear),
        ax=ax_mps2,
        ay=ay_mps2,
        yaw=yaw_rad,
    )
