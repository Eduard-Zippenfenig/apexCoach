import { MobileLayout } from "@/components/MobileLayout";
import { sessions, Session } from "@/data/mockData";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, AlertTriangle, CheckCircle2, MessageSquare } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";

const analysisTabs = ["Overview", "Corners", "Inputs", "Coach", "Heatmap"];

const SVG_W = 320;
const SVG_H = 320;
const PAD = 20;

interface TrackData { left_border: [number,number][]; right_border: [number,number][]; }
interface HeatmapData { x: number[]; y: number[]; time_loss: number[]; }

function MobileHeatmap() {
  const [track, setTrack] = useState<TrackData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
    Promise.all([
      fetch(`${API_BASE}/track`).then(r => r.ok ? r.json() : Promise.reject("track failed")),
      fetch(`${API_BASE}/analysis/time-loss-map`).then(r => r.ok ? r.json() : Promise.reject("heatmap failed")),
    ])
      .then(([t, h]) => { setTrack(t); setHeatmap(h); })
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const norm = useMemo(() => {
    if (!track || !heatmap) return null;
    const allX = [...track.left_border.map((p: [number,number]) => p[0]), ...track.right_border.map((p: [number,number]) => p[0])];
    const allY = [...track.left_border.map((p: [number,number]) => p[1]), ...track.right_border.map((p: [number,number]) => p[1])];
    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const minY = Math.min(...allY), maxY = Math.max(...allY);
    const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
    const scale = Math.min((SVG_W - PAD*2) / rangeX, (SVG_H - PAD*2) / rangeY);
    const offX = PAD + ((SVG_W - PAD*2) - rangeX*scale) / 2;
    const offY = PAD + ((SVG_H - PAD*2) - rangeY*scale) / 2;
    const toSVG = (wx: number, wy: number) => ({ x: offX+(wx-minX)*scale, y: offY+(maxY-wy)*scale });
    const toPolyline = (pts: { x: number; y: number }[]) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const maxLoss = Math.max(...heatmap.time_loss, 0.001);
    const hmPts = heatmap.x.map((wx, i) => {
      const { x, y } = toSVG(wx, heatmap.y[i]);
      const t = Math.min(heatmap.time_loss[i] / maxLoss, 1);
      const r = Math.round(t < 0.5 ? t*2*255 : 255);
      const g = Math.round(t < 0.5 ? 200 : (1-(t-0.5)*2)*200);
      return { x, y, color: `rgb(${r},${g},0)`, loss: heatmap.time_loss[i] };
    });
    return {
      leftPts: toPolyline(track.left_border.map((p: [number,number]) => toSVG(p[0], p[1]))),
      rightPts: toPolyline(track.right_border.map((p: [number,number]) => toSVG(p[0], p[1]))),
      hmPts,
    };
  }, [track, heatmap]);

  if (loading) return <div className="apex-card flex items-center justify-center h-48"><p className="text-muted-foreground text-sm">Loading heatmap...</p></div>;
  if (err || !norm) return <div className="apex-card flex items-center justify-center h-48"><p className="text-destructive text-sm">Failed: {err}</p></div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="apex-card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="stat-label">Time Loss Heatmap</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-primary">Good</span>
            <div className="w-10 h-1.5 rounded-full" style={{ background: "linear-gradient(to right, rgb(0,200,0), rgb(255,200,0), rgb(255,0,0))" }} />
            <span className="text-[9px] font-mono text-destructive">Lost</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full rounded-lg" style={{ background: "hsl(var(--secondary))" }}>
          <polyline points={norm.leftPts} fill="none" stroke="hsl(var(--border))" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={norm.rightPts} fill="none" stroke="hsl(var(--border))" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          {norm.hmPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={p.color} opacity={0.8} />
          ))}
        </svg>
      </div>
      <div className="apex-card p-3">
        <span className="stat-label mb-2 block">Biggest Loss Zones</span>
        <div className="flex flex-col gap-1">
          {norm.hmPts.slice().sort((a,b) => b.loss-a.loss).slice(0,5).map((p,i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">Zone #{i+1}</span>
              <span className="font-mono text-xs font-bold text-destructive">{p.loss.toFixed(3)}s</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PostAnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Overview");
  
  // Try to find in localStorage if it exists, otherwise fallback to mock
  const session = useMemo(() => {
    const lastSessionRaw = localStorage.getItem("apexcoach_last_session");
    if (lastSessionRaw && id === "last-synced") {
      try {
        const parsed = JSON.parse(lastSessionRaw);
        // Map backend names to mobile session interface names
        return {
          ...parsed,
          id: "last-synced",
          bestLap: parsed.lap_time_s ? `${Math.floor(parsed.lap_time_s / 60)}:${(parsed.lap_time_s % 60).toFixed(1)}` : "1:20.5",
          referenceLap: parsed.ref_lap_time_s ? `${Math.floor(parsed.ref_lap_time_s / 60)}:${(parsed.ref_lap_time_s % 60).toFixed(1)}` : "1:14.8",
          totalLaps: 1,
          consistency: parsed.scores?.smoothness || 85,
          brakingScore: parsed.scores?.braking || 70,
          exitScore: parsed.scores?.throttle || 70,
          smoothness: parsed.scores?.smoothness || 70,
          cornerEntry: parsed.scores?.line || 70,
          coachSummary: parsed.coaching_report?.executive_summary || "Analyzing your performance...",
          strengths: parsed.coaching_report?.driver_profile_interpretation?.strengths || [],
          mistakes: parsed.coaching_report?.biggest_time_opportunities?.map((o: any) => o.opportunity) || [],
          recommendations: parsed.coaching_report?.next_session_focus?.map((f: any) => f.title) || [],
          corners: parsed.corners?.map((c: any) => ({
            name: c.corner_name,
            entrySpeed: 180, // placeholder as backend doesn't send specific speeds yet
            apexSpeed: 80,
            exitSpeed: 120,
            brakePoint: "Good",
            throttlePickup: "Good",
            timeLost: `+${c.estimated_time_loss_s?.toFixed(2)}s`,
            comment: c.primary_issue?.replace(/_/g, " ") || "No major issues"
          })) || [],
          sectors: [
             { sector: 1, time: "28.5", delta: "+0.2", best: false },
             { sector: 2, time: "25.2", delta: "-0.1", best: true },
             { sector: 3, time: "27.2", delta: "+0.8", best: false },
          ]
        } as Session;
      } catch (e) { console.error(e); }
    }
    return sessions.find((s) => s.id === id) as Session | undefined;
  }, [id]);

  if (!session) return <MobileLayout><div className="p-6 text-center text-muted-foreground">Session not found</div></MobileLayout>;

  const telemetryData = Array.from({ length: 50 }, (_, i) => ({
    dist: i * 100,
    speed: 80 + Math.sin(i * 0.3) * 60 + Math.random() * 10,
    refSpeed: 85 + Math.sin(i * 0.3) * 65,
    brake: Math.max(0, Math.sin(i * 0.6 - 1) * 100),
    throttle: Math.max(0, Math.cos(i * 0.6) * 100),
  }));

  // Total time lost
  const totalTimeLost = session.corners.reduce((sum, c) => {
    const val = parseFloat(c.timeLost.replace("s", ""));
    return sum + (val > 0 ? val : 0);
  }, 0);

  const mistakeCorners = session.corners.filter(c => parseFloat(c.timeLost.replace("s", "")) > 0.2);
  const cleanCorners = session.corners.filter(c => parseFloat(c.timeLost.replace("s", "")) <= 0.1);

  return (
    <MobileLayout>
      <div className="flex flex-col gap-4 px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-secondary">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-display text-lg font-bold">Post Analysis</h1>
              <p className="text-xs text-muted-foreground">{session.track} · {session.bestLap} best lap</p>
            </div>
          </div>
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto hide-scrollbar rounded-xl bg-secondary p-1">
          {analysisTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-shrink-0 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {tab === "Overview" && (
            <div className="flex flex-col gap-4">
              {/* Track map with mistake zones */}
              <div className="apex-card">
                <div className="relative w-full h-48 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden">
                  <svg viewBox="0 0 400 200" className="w-full h-full p-4">
                    <path d="M50,100 Q50,30 120,30 L200,30 Q240,30 260,60 Q280,90 300,80 Q340,60 360,80 Q380,120 340,140 L200,160 Q140,170 100,150 Q60,130 50,100 Z" fill="none" stroke="hsl(220, 13%, 85%)" strokeWidth="12" strokeLinecap="round" />
                    <path d="M50,100 Q50,30 120,30 L200,30 Q240,30 260,60 Q280,90 300,80 Q340,60 360,80 Q380,120 340,140 L200,160 Q140,170 100,150 Q60,130 50,100 Z" fill="none" stroke="hsl(217, 91%, 55%)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 2" />
                    <path d="M55,100 Q55,35 120,35 L198,35 Q235,35 255,62 Q275,88 298,78 Q335,60 355,82 Q372,118 336,138 L200,155 Q142,165 104,147 Q64,128 55,100 Z" fill="none" stroke="hsl(142, 71%, 40%)" strokeWidth="2" strokeLinecap="round" />
                    {/* Mistake zones — red circles */}
                    <circle cx="260" cy="60" r="14" fill="hsl(0, 84%, 55%)" opacity="0.15" />
                    <text x="260" y="48" textAnchor="middle" fontSize="8" fill="hsl(0, 84%, 55%)">T7</text>
                    <circle cx="340" cy="140" r="16" fill="hsl(0, 84%, 55%)" opacity="0.2" />
                    <text x="340" y="128" textAnchor="middle" fontSize="8" fill="hsl(0, 84%, 55%)">T11</text>
                    {/* Clean zones — green circles */}
                    <circle cx="120" cy="30" r="10" fill="hsl(142, 71%, 40%)" opacity="0.15" />
                    <text x="120" y="18" textAnchor="middle" fontSize="8" fill="hsl(142, 71%, 40%)">T1</text>
                  </svg>
                  <div className="absolute top-2 left-2 flex gap-2">
                    <div className="flex items-center gap-1 rounded bg-card/90 px-1.5 py-0.5 text-[10px] shadow-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-apex-red" /> Time lost
                    </div>
                    <div className="flex items-center gap-1 rounded bg-card/90 px-1.5 py-0.5 text-[10px] shadow-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-apex-green" /> Clean
                    </div>
                  </div>
                </div>
              </div>

              {/* Time loss summary */}
              <div className="apex-card">
                <span className="stat-label">Time Lost to Reference</span>
                <div className="font-mono text-3xl font-bold text-apex-red mt-1">+{totalTimeLost.toFixed(1)}s</div>
                <p className="text-xs text-muted-foreground mt-1">Across {mistakeCorners.length} corners vs reference lap {session.referenceLap}</p>
              </div>

              {/* Where you lost time */}
              {mistakeCorners.length > 0 && (
                <div className="apex-card">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={14} className="text-apex-red" />
                    <span className="stat-label text-apex-red">Where You Lost Time</span>
                  </div>
                  {mistakeCorners.map((c) => (
                    <div key={c.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.comment}</p>
                      </div>
                      <span className="font-mono text-sm font-bold text-apex-red">{c.timeLost}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* What went well */}
              {cleanCorners.length > 0 && (
                <div className="apex-card">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={14} className="text-apex-green" />
                    <span className="stat-label text-apex-green">Clean Execution</span>
                  </div>
                  {cleanCorners.map((c) => (
                    <div key={c.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.comment}</p>
                      </div>
                      <span className="font-mono text-sm font-bold text-apex-green">{c.timeLost}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sector performance */}
              {session.sectors.length > 0 && (
                <div className="apex-card">
                  <span className="stat-label mb-3 block">Sector Breakdown</span>
                  {session.sectors.map((sec) => (
                    <div key={sec.sector} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                      <span className="text-sm font-medium">Sector {sec.sector}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold">{sec.time}s</span>
                        <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${sec.delta.startsWith("-") ? "bg-apex-green/10 text-apex-green" : "bg-apex-red/10 text-apex-red"}`}>
                          {sec.delta}s
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "Corners" && (
            <div className="flex flex-col gap-3">
              {session.corners.length > 0 ? session.corners.map((c) => {
                const lost = parseFloat(c.timeLost.replace("s", ""));
                const isGood = lost <= 0.1;
                return (
                  <div key={c.name} className={`apex-card border-l-4 ${isGood ? "border-l-apex-green" : lost > 0.3 ? "border-l-apex-red" : "border-l-apex-yellow"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display text-sm font-bold">{c.name}</span>
                      <span className={`font-mono text-sm font-bold ${isGood ? "text-apex-green" : "text-apex-red"}`}>
                        {c.timeLost}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{c.comment}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-secondary px-2 py-1.5 text-center">
                        <span className="font-mono text-xs font-bold">{c.entrySpeed}</span>
                        <p className="text-[10px] text-muted-foreground">Entry</p>
                      </div>
                      <div className="rounded-lg bg-secondary px-2 py-1.5 text-center">
                        <span className="font-mono text-xs font-bold">{c.apexSpeed}</span>
                        <p className="text-[10px] text-muted-foreground">Apex</p>
                      </div>
                      <div className="rounded-lg bg-secondary px-2 py-1.5 text-center">
                        <span className="font-mono text-xs font-bold">{c.exitSpeed}</span>
                        <p className="text-[10px] text-muted-foreground">Exit</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.brakePoint === "Good" ? "bg-apex-green/10 text-apex-green" : "bg-apex-yellow/10 text-apex-yellow"}`}>
                        Brake: {c.brakePoint}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.throttlePickup === "Late" ? "bg-apex-yellow/10 text-apex-yellow" : "bg-apex-green/10 text-apex-green"}`}>
                        Throttle: {c.throttlePickup}
                      </span>
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-muted-foreground text-center py-8">Corner data not available</p>}
            </div>
          )}

          {tab === "Inputs" && (
            <div className="flex flex-col gap-4">
              {[
                { label: "Speed — You vs Reference", key: "speed" as const, refKey: "refSpeed" as const, color: "hsl(142, 71%, 40%)", refColor: "hsl(217, 91%, 55%)" },
                { label: "Brake Pressure", key: "brake" as const, color: "hsl(0, 84%, 55%)" },
                { label: "Throttle", key: "throttle" as const, color: "hsl(142, 71%, 40%)" },
              ].map((trace) => (
                <div key={trace.label} className="apex-card">
                  <span className="stat-label">{trace.label}</span>
                  <div className="mt-2 h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={telemetryData}>
                        <YAxis hide />
                        <XAxis hide />
                        {trace.refKey && <Line type="monotone" dataKey={trace.refKey} stroke={trace.refColor} strokeWidth={1} dot={false} strokeDasharray="3 3" />}
                        <Line type="monotone" dataKey={trace.key} stroke={trace.color} strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "Heatmap" && <MobileHeatmap />}

          {tab === "Coach" && (
            <div className="flex flex-col gap-3">
              <div className="apex-card border-l-4 border-l-apex-blue">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={14} className="text-apex-blue" />
                  <span className="stat-label text-apex-blue">Coach Summary</span>
                </div>
                <p className="text-sm leading-relaxed">{session.coachSummary}</p>
              </div>

              <div className="apex-card">
                <span className="stat-label text-apex-green">What Improved</span>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {session.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-apex-green" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="apex-card">
                <span className="stat-label text-apex-red">Focus Areas</span>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {session.mistakes.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-apex-red" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>

              {session.recommendations.length > 0 && (
                <div className="apex-card">
                  <span className="stat-label text-apex-yellow">Next Session Focus</span>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {session.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-apex-yellow" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </motion.div>

        <div className="h-2" />
      </div>
    </MobileLayout>
  );
}
