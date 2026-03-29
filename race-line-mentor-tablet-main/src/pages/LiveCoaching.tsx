import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { liveState } from "@/data/mockData";
import {
  createLiveStream, fetchUserTrace, fetchRefTrace, fetchTrackData,
  formatLapTime, type LiveFrame, type TraceData, type TrackData,
} from "@/lib/api";
import SpeedGauge from "@/components/SpeedGauge";

const TRACK_LENGTH_M = 2451;
const CUE_MIN_DURATION_S = 3.0;

type CueColor = "red" | "yellow" | "green" | "blue";

function cueColorFromFrame(frame: LiveFrame): CueColor {
  const { type, severity } = frame.cue;
  if (type === "GOOD_EXIT" || type === "ON_TARGET") return "green";
  if (severity === "ALERT") return "red";
  if (severity === "WARN") return "yellow";
  return "blue";
}

function speak(text: string, enabled: boolean) {
  if (!enabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.1;
  u.pitch = 1.0;
  u.volume = 1.0;
  window.speechSynthesis.speak(u);
}

// ─── SVG map helpers (module-level, no React dependency) ──────

const SVG_W = 560;
const SVG_H = 560;
const PAD = 5;

/** Normalise real-world [x,y] arrays to SVG coords, preserving aspect ratio. */
function normalise(
  points: { x: number[]; y: number[] },
  allXY: { x: number[]; y: number[] },
): { nx: number[]; ny: number[] } {
  const minX = Math.min(...allXY.x);
  const maxX = Math.max(...allXY.x);
  const minY = Math.min(...allXY.y);
  const maxY = Math.max(...allXY.y);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = Math.min((SVG_W - PAD * 2) / rangeX, (SVG_H - PAD * 2) / rangeY);
  const offX = PAD + ((SVG_W - PAD * 2) - rangeX * scale) / 2;
  const offY = PAD + ((SVG_H - PAD * 2) - rangeY * scale) / 2;
  return {
    nx: points.x.map((v) => offX + (v - minX) * scale),
    ny: points.y.map((v) => offY + (maxY - v) * scale), // flip Y
  };
}

function polyStr(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
}

/** Closed polygon: left border forward + right border backward. */
function roadPolygonPts(lb: { nx: number[]; ny: number[] }, rb: { nx: number[]; ny: number[] }): string {
  const fwd = lb.nx.map((x, i) => `${x.toFixed(1)},${lb.ny[i].toFixed(1)}`);
  const rev = rb.nx.map((_, i) => {
    const ri = rb.nx.length - 1 - i;
    return `${rb.nx[ri].toFixed(1)},${rb.ny[ri].toFixed(1)}`;
  });
  return [...fwd, ...rev].join(" ");
}

/** Binary-search distances[] for the index closest to targetDist. */
function refIdxAtDistance(distances: number[], targetDist: number): number {
  let lo = 0, hi = distances.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (distances[mid] < targetDist) lo = mid + 1; else hi = mid;
  }
  return Math.max(0, Math.min(lo, distances.length - 1));
}

// ─────────────────────────────────────────────────────────────

const InputBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-display uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-[10px] font-mono text-foreground">{Math.round(value * 100)}%</span>
    </div>
    <div className="h-2 bg-secondary rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-100"
        style={{ width: `${value * 100}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

const LiveCoaching = () => {
  const navigate = useNavigate();
  const [showPause, setShowPause] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const [mirrored, setMirrored] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const isPausedRef = useRef(false);

  const [speed, setSpeed] = useState(0);
  const [refSpeed, setRefSpeed] = useState(0);
  const [lapTime, setLapTime] = useState("0:00.0");
  const [delta, setDelta] = useState("+0.00");
  const [throttle, setThrottle] = useState(0);
  const [brake, setBrake] = useState(0);
  const [segment, setSegment] = useState("—");
  const [distanceM, setDistanceM] = useState(0);
  const [connected, setConnected] = useState(false);

  // Static data (loaded once at mount)
  const [userTrace, setUserTrace] = useState<TraceData | null>(null);
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const [refTrace, setRefTrace] = useState<TraceData | null>(null);

  // Live car positions on the SVG map
  const [goodCarSvg, setGoodCarSvg] = useState<{ x: number; y: number } | null>(null);
  const [refCarSvg, setRefCarSvg] = useState<{ x: number; y: number } | null>(null);

  // Data mirrors — let imperative callbacks read latest values without stale-closure issues
  const refTraceRef = useRef<TraceData | null>(null);
  const trackDataRef = useRef<TrackData | null>(null);
  const userTraceRef = useRef<TraceData | null>(null);
  useEffect(() => { refTraceRef.current = refTrace; }, [refTrace]);
  useEffect(() => { trackDataRef.current = trackData; }, [trackData]);
  useEffect(() => { userTraceRef.current = userTrace; }, [userTrace]);

  // Normalisation function ref — populated from memo, read in SSE callback
  const normFnRef = useRef<((x: number, y: number) => { nx: number; ny: number }) | null>(null);

  const [cue, setCue] = useState<{
    text: string; detail: string; type: CueColor;
    deltaSpeed: number; deltaBrake: number; timeLoss: number;
  }>({
    text: "CONNECTING…", detail: "Waiting for telemetry stream",
    type: "blue", deltaSpeed: 0, deltaBrake: 0, timeLoss: 0,
  });
  const lastCueChangeRef = useRef(0);
  const lastCueTypeRef = useRef("");
  const audioOnRef = useRef(audioOn);
  useEffect(() => { audioOnRef.current = audioOn; }, [audioOn]);

  const setupRaw = localStorage.getItem("apexcoach_setup");
  const setup = setupRaw ? JSON.parse(setupRaw) : {};
  const mode = (setup.mode || "push").toLowerCase();
  const driverLevel = (setup.experience || "intermediate").toLowerCase();

  // ── Load static data ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([fetchUserTrace(), fetchTrackData(), fetchRefTrace()])
      .then(([u, t, r]) => { setUserTrace(u); setTrackData(t); setRefTrace(r); })
      .catch(() => { });
  }, []);

  // ── All coordinate bounds (track + user + ref) ────────────────
  const allXY = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    if (trackData) {
      trackData.left_border.forEach(([x, y]) => { xs.push(x); ys.push(y); });
      trackData.right_border.forEach(([x, y]) => { xs.push(x); ys.push(y); });
    }
    if (userTrace) { xs.push(...userTrace.x); ys.push(...userTrace.y); }
    if (refTrace) { xs.push(...refTrace.x); ys.push(...refTrace.y); }
    return { x: xs, y: ys };
  }, [trackData, userTrace, refTrace]);

  // ── Normalised track borders ──────────────────────────────────
  const normBorders = useMemo(() => {
    if (!trackData || allXY.x.length === 0) return null;
    const lb = normalise({ x: trackData.left_border.map(p => p[0]), y: trackData.left_border.map(p => p[1]) }, allXY);
    const rb = normalise({ x: trackData.right_border.map(p => p[0]), y: trackData.right_border.map(p => p[1]) }, allXY);
    const cl = normalise({ x: trackData.centerline.map(p => p[0]), y: trackData.centerline.map(p => p[1]) }, allXY);
    return { lb, rb, cl };
  }, [trackData, allXY]);

  // ── Normalised good-lap trace (downsampled, static background) ─
  const normUserTrace = useMemo(() => {
    if (!userTrace || allXY.x.length === 0) return null;
    const step = 4;
    const xs = userTrace.x.filter((_, i) => i % step === 0);
    const ys = userTrace.y.filter((_, i) => i % step === 0);
    return normalise({ x: xs, y: ys }, allXY);
  }, [userTrace, allXY]);

  // ── Single-point normalise function (for live car positions) ──
  const normFn = useMemo(() => {
    if (allXY.x.length === 0) return null;
    const minX = Math.min(...allXY.x);
    const maxX = Math.max(...allXY.x);
    const minY = Math.min(...allXY.y);
    const maxY = Math.max(...allXY.y);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = Math.min((SVG_W - PAD * 2) / rangeX, (SVG_H - PAD * 2) / rangeY);
    const offX = PAD + ((SVG_W - PAD * 2) - rangeX * scale) / 2;
    const offY = PAD + ((SVG_H - PAD * 2) - rangeY * scale) / 2;
    return (x: number, y: number) => ({
      nx: offX + (x - minX) * scale,
      ny: offY + (maxY - y) * scale,
    });
  }, [allXY]);
  useEffect(() => { normFnRef.current = normFn; }, [normFn]);

  // ── SSE live stream ───────────────────────────────────────────
  useEffect(() => {
    const es = createLiveStream(1.0, driverLevel, mode);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (event) => {
      if (isPausedRef.current) return;
      const frame: LiveFrame = JSON.parse(event.data);
      if (frame.event === "lap_complete") {
        es.close();
        navigate("/summary");
        return;
      }

      setSpeed(Math.round(frame.speed_kph));
      setRefSpeed(Math.round(frame.ref_speed_kph));
      setLapTime(formatLapTime(frame.elapsed_s));
      const sign = frame.delta_time_s >= 0 ? "+" : "";
      setDelta(`${sign}${frame.delta_time_s.toFixed(2)}`);
      setThrottle(frame.throttle);
      setBrake(frame.brake);
      setSegment(frame.segment || "—");
      setDistanceM(Math.round(frame.lap_distance_m));

      // ── SVG car position update ───────────────────────────────
      const fn = normFnRef.current;
      const rt = refTraceRef.current;
      if (fn) {
        if (frame.x != null && frame.y != null) {
          const p = fn(frame.x, frame.y);
          setGoodCarSvg({ x: p.nx, y: p.ny });
        }
        if (rt?.distance?.length && rt.x?.length) {
          const idx = refIdxAtDistance(rt.distance, frame.lap_distance_m);
          const p = fn(rt.x[idx], rt.y[idx]);
          setRefCarSvg({ x: p.nx, y: p.ny });
        }
      }

      // ── Cue logic ─────────────────────────────────────────────
      const now = Date.now() / 1000;
      const cueType = frame.cue.type;
      const elapsed = now - lastCueChangeRef.current;
      const typeChanged = cueType !== lastCueTypeRef.current;

      if (typeChanged && elapsed >= CUE_MIN_DURATION_S) {
        const newCue = {
          text: frame.cue.short_message || "ON TARGET",
          detail: frame.cue.audio_message || "",
          type: cueColorFromFrame(frame),
          deltaSpeed: frame.cue.delta_speed_kph,
          deltaBrake: frame.cue.delta_brake_m,
          timeLoss: frame.cue.time_loss_estimate_s,
        };
        setCue(newCue);
        lastCueChangeRef.current = now;
        lastCueTypeRef.current = cueType;
        if (frame.cue.audio_message) {
          speak(frame.cue.audio_message, audioOnRef.current);
        }
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => { es.close(); window.speechSynthesis?.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, mode, driverLevel]);

  const handlePause = () => { isPausedRef.current = true; setShowPause(true); window.speechSynthesis?.cancel(); };
  const handleResume = () => { isPausedRef.current = false; setShowPause(false); };
  const handleStop = () => { esRef.current?.close(); window.speechSynthesis?.cancel(); navigate("/summary"); };

  const cueTextColor =
    cue.type === "red" ? "text-destructive" :
      cue.type === "green" ? "text-primary" :
        cue.type === "yellow" ? "text-apex-yellow" : "text-accent";

  const cueBorderBg =
    cue.type === "red" ? "border-destructive/40 bg-destructive/10" :
      cue.type === "green" ? "border-primary/40 bg-primary/10" :
        cue.type === "yellow" ? "border-apex-yellow/40 bg-apex-yellow/10" :
          "border-accent/40 bg-accent/10";

  const deltaPositive = delta.startsWith("+");

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden select-none" style={mirrored ? { transform: "scaleX(-1)" } : undefined}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-6">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          <div className="flex items-center gap-2 border-l border-border pl-6">
            <div className={`w-3 h-3 rounded-full ${connected ? "bg-primary animate-pulse" : "bg-destructive"}`} />
            <span className={`font-mono text-sm uppercase tracking-wider font-bold ${connected ? "text-primary" : "text-destructive"}`}>
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Segment</p>
            <p className="text-base font-display font-bold text-foreground truncate max-w-[160px]">{segment}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Distance</p>
            <p className="text-base font-mono font-bold text-foreground">{distanceM}m</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Lap Time</p>
          <p className="text-4xl font-mono font-bold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{lapTime}</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Δ Time</p>
            <p className={`text-4xl font-mono font-bold ${deltaPositive ? "text-destructive" : "text-primary"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
              {delta}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            {[["GPS", connected], ["IMU", connected], ["STR", connected]].map(([label, ok]) => (
              <div key={String(label)} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-primary" : "bg-muted-foreground"}`} />
                <span className="text-[10px] font-mono text-muted-foreground">{String(label)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex min-h-0">

        {/* Left: Speed gauge + inputs */}
        <div className="flex flex-col items-center justify-center w-[300px] border-r border-border px-4 gap-4">
          <SpeedGauge speed={speed} max={liveState.maxSpeed} />

          <div className="w-full apex-card p-3 flex justify-between items-center">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">You</p>
              <p className="text-xl font-mono font-bold text-foreground">{speed}</p>
            </div>
            <div className="text-center">
              <p className={`text-sm font-mono font-bold ${speed >= refSpeed ? "text-primary" : "text-destructive"}`}>
                {speed >= refSpeed ? "+" : ""}{speed - refSpeed} kph
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Ref</p>
              <p className="text-xl font-mono font-bold text-accent">{refSpeed}</p>
            </div>
          </div>

          <div className="w-full flex flex-col gap-2 px-1">
            <InputBar label="Throttle" value={throttle} color="hsl(var(--apex-green))" />
            <InputBar label="Brake" value={brake} color="hsl(var(--apex-red))" />
          </div>
        </div>

        {/* Center: SVG track map + cue */}
        <div className="flex-1 flex flex-col items-center justify-center relative min-h-0 p-2" style={{ background: "transparent" }}>
          {normBorders && (
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full h-full"
              style={{ background: "transparent" }}
            >
              {/* Road surface — filled polygon (dark, subtle fill) */}
              <polygon
                points={roadPolygonPts(normBorders.lb, normBorders.rb)}
                fill="hsl(var(--secondary))" opacity={0.6}
              />
              {/* Left border — thick green */}
              <polyline
                points={polyStr(normBorders.lb.nx, normBorders.lb.ny)}
                fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round" opacity={1}
              />
              {/* Right border — thick green */}
              <polyline
                points={polyStr(normBorders.rb.nx, normBorders.rb.ny)}
                fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round" opacity={1}
              />
              {/* Centerline — dashed */}
              <polyline
                points={polyStr(normBorders.cl.nx, normBorders.cl.ny)}
                fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5"
                opacity={0.6} strokeDasharray="6 6"
              />
              {/* Good-lap static trace (subtle racing line) */}
              {normUserTrace && (
                <polyline
                  points={polyStr(normUserTrace.nx, normUserTrace.ny)}
                  fill="none" stroke="#4f8ef7" strokeWidth="2"
                  opacity={0.35} strokeLinecap="round"
                />
              )}
              {/* Ref car dot (ghost) */}
              {refCarSvg && (
                <>
                  <circle cx={refCarSvg.x} cy={refCarSvg.y} r={14}
                    fill="#788cc8" opacity={0.08}
                  />
                  <circle cx={refCarSvg.x} cy={refCarSvg.y} r={8}
                    fill="#788cc8" stroke="#788cc8" strokeWidth={1.5}
                    opacity={0.6}
                    style={{ filter: "drop-shadow(0 0 6px rgba(120,140,200,0.4))" }}
                  />
                </>
              )}
              {/* Good car dot (live — red) */}
              {goodCarSvg && connected && (
                <>
                  <circle cx={goodCarSvg.x} cy={goodCarSvg.y} r={18}
                    fill="#e53e3e" opacity={0.12}
                  />
                  <circle cx={goodCarSvg.x} cy={goodCarSvg.y} r={10}
                    fill="#e53e3e" stroke="#ffffff" strokeWidth={2.5}
                    style={{ filter: "drop-shadow(0 0 10px rgba(229,62,62,0.6))" }}
                  >
                    <animate attributeName="r" values="9;12;9" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                </>
              )}
            </svg>
          )}

          {/* Primary coaching cue */}
          <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2">
            <div className="px-10 py-4 rounded-2xl border-2 backdrop-blur-sm" style={{
              borderColor: cue.type === 'red' ? '#e53e3e' : cue.type === 'green' ? '#38d988' : cue.type === 'yellow' ? '#f6c343' : '#4f8ef7',
              background: cue.type === 'red' ? 'rgba(229,62,62,0.15)' : cue.type === 'green' ? 'rgba(56,217,136,0.1)' : cue.type === 'yellow' ? 'rgba(246,195,67,0.12)' : 'rgba(79,142,247,0.1)',
              color: cue.type === 'red' ? '#e53e3e' : cue.type === 'green' ? '#38d988' : cue.type === 'yellow' ? '#f6c343' : '#4f8ef7',
            }}>
              <p className="text-5xl font-display font-bold tracking-wider text-center" style={{ color: 'inherit' }}>
                {cue.text.toUpperCase()}
              </p>
              {cue.detail && cue.detail !== cue.text && (
                <p className="text-sm font-body text-center mt-1 opacity-70" style={{ color: 'inherit' }}>{cue.detail}</p>
              )}
            </div>

            {(Math.abs(cue.deltaSpeed) > 1 || Math.abs(cue.deltaBrake) > 1) && (
              <div className="flex gap-3">
                {Math.abs(cue.deltaBrake) > 1 && (
                  <span className="px-3 py-1 rounded-full text-xs font-mono" style={{ background: 'rgba(26,29,46,0.9)', border: '1px solid #3a3d55', color: '#e2e4f0' }}>
                    Brake {cue.deltaBrake > 0 ? "+" : ""}{cue.deltaBrake.toFixed(0)}m
                  </span>
                )}
                {Math.abs(cue.deltaSpeed) > 1 && (
                  <span className="px-3 py-1 rounded-full text-xs font-mono" style={{ background: 'rgba(26,29,46,0.9)', border: '1px solid #3a3d55', color: '#e2e4f0' }}>
                    Speed {cue.deltaSpeed > 0 ? "+" : ""}{cue.deltaSpeed.toFixed(0)} kph
                  </span>
                )}
                {cue.timeLoss > 0.05 && (
                  <span className="px-3 py-1 rounded-full text-xs font-mono" style={{ background: 'rgba(229,62,62,0.2)', border: '1px solid rgba(229,62,62,0.3)', color: '#e53e3e' }}>
                    ~{cue.timeLoss.toFixed(2)}s lost
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Metrics + controls */}
        <div className="w-[200px] border-l border-border flex flex-col p-4 gap-3">
          <div className="apex-card p-4">
            <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Reference</p>
            <p className="text-xl font-mono font-bold text-accent" style={{ fontVariantNumeric: "tabular-nums" }}>{liveState.referencePace}</p>
          </div>

          <div className="apex-card p-4">
            <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Track %</p>
            <div className="mt-1.5 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${(distanceM / TRACK_LENGTH_M) * 100}%` }} />
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-1">{distanceM} / {TRACK_LENGTH_M}m</p>
          </div>

          <div className="apex-card p-4">
            <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Mode</p>
            <p className="text-base font-display font-bold text-primary tracking-wider uppercase">{mode}</p>
          </div>

          <div className="apex-card p-4">
            <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Audio</p>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2.5 h-2.5 rounded-full ${audioOn ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
              <span className="text-xs font-body text-foreground font-semibold">{audioOn ? "ON" : "OFF"}</span>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setAudioOn(!audioOn); window.speechSynthesis?.cancel(); }}
              className="apex-btn-secondary w-full text-center text-xs uppercase tracking-wider py-2.5 font-bold"
            >
              {audioOn ? "Mute" : "Unmute"}
            </button>
            <button
              onClick={() => setMirrored(m => !m)}
              className={`w-full text-center text-xs uppercase tracking-wider py-2.5 font-bold rounded-lg border transition-colors ${mirrored ? "bg-accent/20 text-accent border-accent/40" : "apex-btn-secondary"}`}
              title="Mirror track view"
            >
              {mirrored ? "Unflip" : "Mirror"}
            </button>
            <button onClick={handlePause} className="apex-btn-secondary w-full text-center text-xs uppercase tracking-wider py-2.5 font-bold">
              Pause
            </button>
            <button onClick={handleStop} className="bg-destructive/20 text-destructive border border-destructive/30 rounded-lg text-xs uppercase tracking-wider py-2.5 font-body font-bold hover:bg-destructive/30 transition-colors">
              Stop
            </button>
          </div>
        </div>
      </div>

      {/* ── Pause overlay ── */}
      {showPause && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="apex-card p-10 flex flex-col gap-5 min-w-[400px]">
            <h2 className="text-3xl font-display font-bold tracking-wider text-foreground text-center">Session Paused</h2>
            <div className="flex flex-col gap-3">
              <button onClick={handleResume} className="apex-btn-primary w-full text-center uppercase tracking-widest py-4 text-lg">
                Resume Session
              </button>
              <button onClick={handleStop} className="bg-destructive/20 text-destructive border border-destructive/30 rounded-lg uppercase tracking-widest py-3 font-body font-bold hover:bg-destructive/30 transition-colors text-center">
                End Session
              </button>
              <button onClick={() => { setAudioOn(!audioOn); }} className="apex-btn-secondary w-full text-center uppercase tracking-wider">
                Audio: {audioOn ? "ON" : "OFF"}
              </button>
              <button className="apex-btn-secondary w-full text-center uppercase tracking-wider">
                Contact Operator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveCoaching;
