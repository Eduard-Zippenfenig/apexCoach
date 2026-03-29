const API_BASE = "/api";

export interface LiveFrame {
  elapsed_s: number;
  lap_distance_m: number;
  speed_kph: number;
  throttle: number;
  brake: number;
  steering: number;
  x: number;
  y: number;
  segment: string;
  cue: {
    type: string;
    severity: string;
    short_message: string;
    audio_message: string;
    delta_speed_kph: number;
    delta_brake_m: number;
    time_loss_estimate_s: number;
  };
  ref_speed_kph: number;
  delta_speed_kph: number;
  delta_time_s: number;
  event?: string;
}

export interface CornerData {
  corner_name: string;
  coaching_priority: number;
  user_entry_speed_kph: number;
  ref_entry_speed_kph: number;
  user_apex_speed_kph: number;
  ref_apex_speed_kph: number;
  user_exit_speed_kph: number;
  ref_exit_speed_kph: number;
  brake_point_delta_m: number;
  throttle_delay_delta_m: number;
  avg_line_deviation_m: number;
  estimated_time_loss_s: number;
  primary_issue: string;
  time_loss_breakdown: { entry: number; apex: number; exit: number };
}

export interface CoachingReport {
  executive_summary: string;
  driver_profile_interpretation: {
    main_strengths: string[];
    main_weaknesses: string[];
    priority_focus: string[];
    driving_style_observations: string[];
  };
  biggest_time_opportunities: Array<{
    theme: string;
    corners_affected: string[];
    estimated_total_gain_s: number;
    why_it_matters: string;
  }>;
  corner_reports: Array<{
    corner: string;
    priority: number;
    headline: string;
    detail: string;
    root_cause: string;
    instruction: string;
    what_to_feel: string;
    common_mistake_to_avoid: string;
    time_gain: string;
  }>;
  next_session_focus: Array<{
    title: string;
    why: string;
    drill: string;
  }>;
  scores: Record<string, number>;
}

export interface AnalysisResult {
  session: {
    user_lap_time_s: number;
    ref_lap_time_s: number;
    total_time_gap_s: number;
    consistency_score: number;
  };
  overall_scores: {
    braking: number;
    line: number;
    throttle: number;
    smoothness: number;
  };
  top_3_improvements: Array<{
    corner: string;
    issue: string;
    gain_s: number;
    suggestion: string;
  }>;
  strongest_section: string;
  weakest_section: string;
  corners: CornerData[];
  coaching_report: CoachingReport;
}

export interface TraceData {
  distance: number[];
  speed_kph: number[];
  throttle: number[];
  brake: number[];
  x: number[];
  y: number[];
  lap_time_s: number;
}

export interface SpeedTraceData {
  distance_m: number[];
  user_speed_kph: number[];
  ref_speed_kph: number[];
  speed_delta_kph: number[];
  user_throttle: number[];
  ref_throttle: number[];
  user_brake: number[];
  ref_brake: number[];
  segments: unknown[];
}

export async function fetchAnalysis(
  driverLevel = "intermediate",
  driverName = "Driver"
): Promise<AnalysisResult> {
  const res = await fetch(
    `${API_BASE}/analysis/post?driver_level=${driverLevel}&driver_name=${encodeURIComponent(driverName)}`
  );
  if (!res.ok) throw new Error(`Analysis fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchUserTrace(): Promise<TraceData> {
  const res = await fetch(`${API_BASE}/user/trace`);
  if (!res.ok) throw new Error(`User trace fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchRefTrace(): Promise<TraceData> {
  const res = await fetch(`${API_BASE}/reference/trace`);
  if (!res.ok) throw new Error(`Ref trace fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSpeedTrace(): Promise<SpeedTraceData> {
  const res = await fetch(`${API_BASE}/analysis/speed-trace`);
  if (!res.ok) throw new Error(`Speed trace fetch failed: ${res.status}`);
  return res.json();
}

export function createLiveStream(
  playbackSpeed = 1.0,
  driverLevel = "intermediate",
  mode = "push"
): EventSource {
  return new EventSource(
    `${API_BASE}/live/stream?playback_speed=${playbackSpeed}&driver_level=${driverLevel}&mode=${mode}`
  );
}

export interface CarAnalysis {
  make: string;
  model: string;
  year: string;
  drivetrain: "RWD" | "FWD" | "AWD";
  power_band: "Low" | "Medium" | "High" | "Race-spec";
  transmission: "Manual" | "Auto" | "Paddle";
}

export async function analyzeCarImage(base64: string, mimeType: string): Promise<CarAnalysis> {
  const res = await fetch(`${API_BASE}/analyze/car`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mime_type: mimeType }),
  });
  if (!res.ok) throw new Error(`Car analysis failed: ${res.status}`);
  return res.json();
}

export interface TrackData {
  map_name: string;
  track_length_m: number;
  left_border: [number, number][];
  right_border: [number, number][];
  centerline: [number, number][];
  segments: unknown[];
}

export interface HeatmapData {
  x: number[];
  y: number[];
  time_loss: number[];
}

export async function fetchTrackData(): Promise<TrackData> {
  const res = await fetch(`${API_BASE}/track`);
  if (!res.ok) throw new Error(`Track fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchHeatmap(): Promise<HeatmapData> {
  const res = await fetch(`${API_BASE}/analysis/time-loss-map`);
  if (!res.ok) throw new Error(`Heatmap fetch failed: ${res.status}`);
  const data = await res.json();
  return {
    x: data.x,
    y: data.y,
    time_loss: data.time_loss_per_meter_s || data.time_loss || []
  };
}

/** Format seconds as M:SS.T  e.g. 81.3 → "1:21.3" */
export function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")}`;
}
