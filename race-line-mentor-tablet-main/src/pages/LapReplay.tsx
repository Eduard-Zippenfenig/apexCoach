import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchUserTrace, fetchRefTrace, fetchTrackData,
  formatLapTime, type TraceData, type TrackData,
} from "@/lib/api";

const SVG_W = 560;
const SVG_H = 560;
const PAD = 20;

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

/** Build a closed polygon: forward along left border + backward along right border. */
function roadPolygonPts(lb: { nx: number[]; ny: number[] }, rb: { nx: number[]; ny: number[] }): string {
  const fwd = lb.nx.map((x, i) => `${x.toFixed(1)},${lb.ny[i].toFixed(1)}`);
  const rev = rb.nx.map((_, i) => {
    const ri = rb.nx.length - 1 - i;
    return `${rb.nx[ri].toFixed(1)},${rb.ny[ri].toFixed(1)}`;
  });
  return [...fwd, ...rev].join(" ");
}

function speedColor(speed: number, minS: number, maxS: number): string {
  const t = Math.max(0, Math.min(1, (speed - minS) / (maxS - minS || 1)));
  // green (fast) → yellow → red (slow)
  if (t > 0.5) {
    const r = Math.round((1 - t) * 2 * 255);
    return `rgb(${r},200,0)`;
  } else {
    const g = Math.round(t * 2 * 200);
    return `rgb(220,${g},0)`;
  }
}

const DOWNSAMPLE = 8; // display every Nth point in the trace

const LapReplay = () => {
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showRef, setShowRef] = useState(true);
  const [layer, setLayer] = useState<"speed" | "throttle" | "brake" | "line">("speed");

  const [userTrace, setUserTrace] = useState<TraceData | null>(null);
  const [refTrace, setRefTrace] = useState<TraceData | null>(null);
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const rafRef = useRef<number | null>(null);
  const playStartWallRef = useRef(0);
  const playStartElapsedRef = useRef(0);

  useEffect(() => {
    Promise.all([fetchUserTrace(), fetchRefTrace(), fetchTrackData()])
      .then(([u, r, t]) => { setUserTrace(u); setRefTrace(r); setTrackData(t); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const lapTime = userTrace?.lap_time_s ?? 1;
  const progress = Math.min(elapsed / lapTime, 1);

  // Real-time playback
  useEffect(() => {
    if (!playing || !userTrace) return;
    playStartWallRef.current = performance.now();
    playStartElapsedRef.current = elapsed;
    const tick = () => {
      const wall = (performance.now() - playStartWallRef.current) / 1000;
      const next = playStartElapsedRef.current + wall;
      if (next >= userTrace.lap_time_s) { setElapsed(userTrace.lap_time_s); setPlaying(false); return; }
      setElapsed(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, userTrace]); // eslint-disable-line react-hooks/exhaustive-deps

  // All coordinate bounds (track + user + ref)
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

  // Normalised track borders
  const normBorders = useMemo(() => {
    if (!trackData || allXY.x.length === 0) return null;
    const lb = normalise({ x: trackData.left_border.map(p => p[0]), y: trackData.left_border.map(p => p[1]) }, allXY);
    const rb = normalise({ x: trackData.right_border.map(p => p[0]), y: trackData.right_border.map(p => p[1]) }, allXY);
    const cl = normalise({ x: trackData.centerline.map(p => p[0]), y: trackData.centerline.map(p => p[1]) }, allXY);
    return { lb, rb, cl };
  }, [trackData, allXY]);

  // Normalised user/ref trace (downsampled)
  const normUser = useMemo(() => {
    if (!userTrace || allXY.x.length === 0) return null;
    const xs = userTrace.x.filter((_, i) => i % DOWNSAMPLE === 0);
    const ys = userTrace.y.filter((_, i) => i % DOWNSAMPLE === 0);
    const speeds = userTrace.speed_kph.filter((_, i) => i % DOWNSAMPLE === 0);
    const throttles = userTrace.throttle.filter((_, i) => i % DOWNSAMPLE === 0);
    const brakes = userTrace.brake.filter((_, i) => i % DOWNSAMPLE === 0);
    const { nx, ny } = normalise({ x: xs, y: ys }, allXY);
    return { nx, ny, speeds, throttles, brakes };
  }, [userTrace, allXY]);

  const normRef = useMemo(() => {
    if (!refTrace || allXY.x.length === 0) return null;
    const xs = refTrace.x.filter((_, i) => i % DOWNSAMPLE === 0);
    const ys = refTrace.y.filter((_, i) => i % DOWNSAMPLE === 0);
    const { nx, ny } = normalise({ x: xs, y: ys }, allXY);
    return { nx, ny };
  }, [refTrace, allXY]);

  // Car position at current elapsed
  const carSvgPos = useMemo(() => {
    if (!userTrace || !normUser) return null;
    const idx = Math.min(Math.floor(progress * (userTrace.x.length - 1)), userTrace.x.length - 1);
    const dsIdx = Math.min(Math.floor(progress * (normUser.nx.length - 1)), normUser.nx.length - 1);
    return { x: normUser.nx[dsIdx], y: normUser.ny[dsIdx], speed: userTrace.speed_kph[idx], idx };
  }, [progress, userTrace, normUser]);

  const refSvgPos = useMemo(() => {
    if (!refTrace || !normRef) return null;
    const refProg = Math.min(elapsed / (refTrace.lap_time_s), 1);
    const dsIdx = Math.min(Math.floor(refProg * (normRef.nx.length - 1)), normRef.nx.length - 1);
    return { x: normRef.nx[dsIdx], y: normRef.ny[dsIdx] };
  }, [elapsed, refTrace, normRef]);

  const minSpeed = useMemo(() => Math.min(...(userTrace?.speed_kph ?? [0])), [userTrace]);
  const maxSpeed = useMemo(() => Math.max(...(userTrace?.speed_kph ?? [300])), [userTrace]);

  // Throttle/brake bars (downsampled to 80 bars)
  const inputBars = useMemo(() => {
    if (!userTrace) return [];
    const target = 80;
    const step = Math.max(1, Math.floor(userTrace.throttle.length / target));
    return Array.from({ length: target }, (_, i) => {
      const srcIdx = i * step;
      return {
        throttle: userTrace.throttle[srcIdx] ?? 0,
        brake: userTrace.brake[srcIdx] ?? 0,
        dist: userTrace.distance[srcIdx] ?? 0,
      };
    });
  }, [userTrace]);

  const currentIdx = userTrace ? Math.min(Math.floor(progress * (userTrace.speed_kph.length - 1)), userTrace.speed_kph.length - 1) : 0;
  const currentSpeed = userTrace ? Math.round(userTrace.speed_kph[currentIdx]) : 0;
  const currentThrottle = userTrace ? userTrace.throttle[currentIdx] : 0;
  const currentBrake = userTrace ? userTrace.brake[currentIdx] : 0;
  const refSpeedNow = refTrace ? Math.round(refTrace.speed_kph[Math.min(Math.floor(Math.min(elapsed / refTrace.lap_time_s, 1) * (refTrace.speed_kph.length - 1)), refTrace.speed_kph.length - 1)]) : 0;

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setElapsed(Number(e.target.value) / 1000 * lapTime);
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [lapTime]);

  const handlePlayPause = () => {
    if (elapsed >= lapTime) setElapsed(0);
    setPlaying(p => !p);
  };

  const bestLap = userTrace ? formatLapTime(userTrace.lap_time_s) : "—";
  const refLap  = refTrace  ? formatLapTime(refTrace.lap_time_s)  : "—";
  const gapS    = userTrace && refTrace ? userTrace.lap_time_s - refTrace.lap_time_s : 0;

  // Segment progress indicator bar
  const barProgress = Math.min(Math.floor(progress * 80), 79);

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-wider text-foreground">Lap Replay</h2>
          <p className="text-muted-foreground font-body text-base">
            Your lap: <span className="text-primary font-mono">{bestLap}</span>
            &nbsp;·&nbsp;Reference: <span className="text-accent font-mono">{refLap}</span>
            {gapS !== 0 && <span className="text-destructive font-mono"> · {gapS > 0 ? "+" : ""}{gapS.toFixed(2)}s</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate("/analysis")} className="apex-btn-secondary uppercase tracking-wider text-sm">Analysis</button>
          <button onClick={() => navigate("/sync")} className="apex-btn-secondary uppercase tracking-wider text-sm">Sync</button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* SVG Track Map */}
        <div className="flex-1 apex-card p-4 flex flex-col items-center justify-center relative overflow-hidden">
          {loading && <p className="text-muted-foreground font-body">Loading MCAP trace data…</p>}
          {error && <p className="text-destructive font-body">Failed to load backend data</p>}
          {!loading && !error && normBorders && normUser && (
            <>
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className="w-full h-full max-h-[500px]"
                style={{ background: "transparent" }}
              >
                {/* Road surface — filled polygon between left and right borders */}
                <polygon
                  points={roadPolygonPts(normBorders.lb, normBorders.rb)}
                  fill="hsl(var(--border))" opacity={0.45}
                />
                {/* Left border */}
                <polyline
                  points={polyStr(normBorders.lb.nx, normBorders.lb.ny)}
                  fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.7}
                />
                {/* Right border */}
                <polyline
                  points={polyStr(normBorders.rb.nx, normBorders.rb.ny)}
                  fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.7}
                />

                {/* Centerline */}
                <polyline
                  points={polyStr(normBorders.cl.nx, normBorders.cl.ny)}
                  fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity={0.3} strokeDasharray="4 4"
                />

                {/* Reference trace */}
                {showRef && normRef && (
                  <polyline
                    points={polyStr(normRef.nx, normRef.ny)}
                    fill="none" stroke="hsl(var(--accent))" strokeWidth="2" opacity={0.4} strokeLinecap="round"
                  />
                )}

                {/* User trace — colored by selected layer */}
                {normUser.nx.map((x, i) => {
                  if (i === 0) return null;
                  const x0 = normUser.nx[i - 1], y0 = normUser.ny[i - 1];
                  let color = "hsl(var(--primary))";
                  if (layer === "speed") color = speedColor(normUser.speeds[i], minSpeed, maxSpeed);
                  else if (layer === "throttle") {
                    const t = normUser.throttles[i];
                    color = `rgba(${Math.round((1 - t) * 80)}, ${Math.round(t * 200 + 55)}, 0, 0.9)`;
                  } else if (layer === "brake") {
                    const b = normUser.brakes[i];
                    color = b > 0.05 ? `rgba(220, ${Math.round((1 - b) * 80)}, 0, 0.9)` : "hsl(var(--muted-foreground))";
                  }
                  return (
                    <line key={i} x1={x0} y1={y0} x2={x} y2={normUser.ny[i]}
                      stroke={color} strokeWidth="3.5" strokeLinecap="round" opacity={0.85}
                    />
                  );
                })}

                {/* Ref car dot */}
                {showRef && refSvgPos && (
                  <circle cx={refSvgPos.x} cy={refSvgPos.y} r={9}
                    fill="hsl(var(--accent))" opacity={0.75}
                    style={{ filter: "drop-shadow(0 0 6px hsl(var(--accent)))" }}
                  />
                )}

                {/* User car dot */}
                {carSvgPos && (
                  <circle cx={carSvgPos.x} cy={carSvgPos.y} r={11}
                    fill="hsl(var(--primary))" stroke="white" strokeWidth={2}
                    style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.9))" }}
                  >
                    <animate attributeName="r" values="10;13;10" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                )}
              </svg>

              {/* Lap time overlays */}
              <div className="absolute top-4 left-4 flex gap-2">
                <div className="bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg px-3 py-2">
                  <p className="text-[9px] text-muted-foreground font-display uppercase tracking-widest">User</p>
                  <p className="text-base font-mono font-bold text-primary">{formatLapTime(elapsed)}</p>
                </div>
                {showRef && refTrace && (
                  <div className="bg-card/90 backdrop-blur-sm border border-accent/30 rounded-lg px-3 py-2">
                    <p className="text-[9px] text-muted-foreground font-display uppercase tracking-widest">Ref</p>
                    <p className="text-base font-mono font-bold text-accent">{formatLapTime(Math.min(elapsed, refTrace.lap_time_s))}</p>
                  </div>
                )}
              </div>

              {/* Speed legend */}
              {layer === "speed" && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(to right, rgb(220,0,0), rgb(255,200,0), rgb(0,200,0))" }} />
                  <span className="text-[10px] font-mono text-muted-foreground">{Math.round(minSpeed)}→{Math.round(maxSpeed)} kph</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right panel: controls + telemetry + input bars */}
        <div className="w-[280px] flex flex-col gap-3">
          {/* Playback */}
          <div className="apex-card p-4 flex flex-col gap-3">
            <h3 className="text-xs font-display tracking-wider text-muted-foreground uppercase">Playback</h3>
            <div className="flex gap-2">
              <button onClick={() => { setElapsed(0); setPlaying(false); if (rafRef.current) cancelAnimationFrame(rafRef.current); }}
                className="apex-btn-secondary px-3 py-2 text-sm">↺</button>
              <button onClick={handlePlayPause} className="apex-btn-primary flex-1 py-2.5 text-sm">
                {playing ? "Pause" : elapsed >= lapTime ? "Replay" : "Play"}
              </button>
            </div>
            <input type="range" min="0" max="1000" value={Math.round(progress * 1000)} onChange={handleScrub} className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>{formatLapTime(elapsed)}</span>
              <span>{bestLap}</span>
            </div>
          </div>

          {/* Live telemetry */}
          <div className="apex-card p-4 flex flex-col gap-2">
            <h3 className="text-xs font-display tracking-wider text-muted-foreground uppercase mb-1">At Position</h3>
            {[
              { label: "Speed", val: `${currentSpeed} kph`, color: "text-foreground" },
              { label: "Ref Speed", val: `${refSpeedNow} kph`, color: "text-accent" },
              { label: "Δ Speed", val: `${currentSpeed - refSpeedNow > 0 ? "+" : ""}${currentSpeed - refSpeedNow} kph`, color: currentSpeed >= refSpeedNow ? "text-primary" : "text-destructive" },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">{label}</span>
                <span className={`font-mono text-sm font-bold ${color}`}>{val}</span>
              </div>
            ))}
            <div className="h-px bg-border my-1" />
            {[
              { label: "Throttle", val: currentThrottle, color: "bg-primary" },
              { label: "Brake", val: currentBrake, color: "bg-destructive" },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-display uppercase tracking-widest text-muted-foreground">
                  <span>{label}</span><span className="font-mono">{Math.round(val * 100)}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${val * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Throttle/Brake bar chart (right-side recommendations) */}
          <div className="apex-card p-4 flex flex-col gap-2 flex-1">
            <h3 className="text-xs font-display tracking-wider text-muted-foreground uppercase">Throttle &amp; Brake — Full Lap</h3>
            <p className="text-[10px] text-muted-foreground font-body">Green = throttle · Red = brake</p>
            <div className="flex-1 flex items-end gap-[2px] relative min-h-[120px]">
              {inputBars.map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end gap-[1px] relative">
                  {/* Throttle bar (bottom up, green) */}
                  <div className="rounded-t-sm opacity-80"
                    style={{ height: `${bar.throttle * 55}px`, backgroundColor: "hsl(var(--apex-green))", minHeight: bar.throttle > 0.05 ? 2 : 0 }}
                  />
                  {/* Brake bar (overlaid on top, red) */}
                  {bar.brake > 0.05 && (
                    <div className="absolute bottom-0 left-0 right-0 rounded-t-sm"
                      style={{ height: `${bar.brake * 55}px`, backgroundColor: "hsl(var(--apex-red))", opacity: 0.85 }}
                    />
                  )}
                  {/* Current position marker */}
                  {i === barProgress && (
                    <div className="absolute bottom-0 top-0 left-0 right-0 rounded border border-white/60 pointer-events-none" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-1">
              <span>Start</span>
              <span>Finish</span>
            </div>
          </div>

          {/* Layer selector */}
          <div className="apex-card p-4 flex flex-col gap-2">
            <h3 className="text-xs font-display tracking-wider text-muted-foreground uppercase">Trace Layer</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {(["speed", "throttle", "brake", "line"] as const).map((l) => (
                <button key={l} onClick={() => setLayer(l)}
                  className={`px-3 py-2 rounded-lg font-body text-xs capitalize transition-all ${
                    layer === l ? "bg-primary/20 text-primary border border-primary/40" : "bg-secondary text-muted-foreground border border-border"
                  }`}
                >{l}</button>
              ))}
            </div>
            <button onClick={() => setShowRef(!showRef)}
              className={`px-3 py-2 rounded-lg font-body text-xs transition-all ${
                showRef ? "bg-accent/20 text-accent border border-accent/40" : "bg-secondary text-muted-foreground border border-border"
              }`}
            >{showRef ? "Hide Reference" : "Show Reference"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LapReplay;
