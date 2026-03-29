import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAnalysis,
  fetchTrackData,
  fetchHeatmap,
  formatLapTime,
  type AnalysisResult,
  type CornerData,
  type TrackData,
  type HeatmapData,
} from "@/lib/api";

const tabs = ["Overview", "Corners", "Recommendations"];

const OverviewTab = ({ analysis }: { analysis: AnalysisResult }) => {
  const { session, overall_scores, coaching_report } = analysis;
  const gap = session.total_time_gap_s;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Best Lap", formatLapTime(session.user_lap_time_s)],
            ["Delta to Ref", `+${gap.toFixed(1)}s`],
            ["Consistency", `${session.consistency_score}%`],
            ["Braking", `${overall_scores.braking}/100`],
            ["Line Score", `${overall_scores.line}/100`],
            ["Smoothness", `${overall_scores.smoothness}/100`],
          ].map(([label, value]) => (
            <div key={label} className="apex-card p-4">
              <span className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">{label}</span>
              <p className="text-xl font-mono font-bold text-foreground mt-1 apex-metric">{value}</p>
            </div>
          ))}
        </div>
        <div className="apex-card p-6 flex flex-col h-full">
          <h3 className="text-sm font-display tracking-wider text-accent mb-4 border-b border-border/50 pb-2">SESSION TRACK SUMMARY</h3>
          <div className="grid grid-cols-2 gap-6 flex-1">
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Weakest Section</span>
                <p className="font-body text-destructive font-bold text-lg mt-1">{analysis.weakest_section || "—"}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Strongest Section</span>
                <p className="font-body text-primary font-bold text-lg mt-1">{analysis.strongest_section || "—"}</p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
               <div>
                  <span className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Total Corners</span>
                  <p className="font-mono font-bold text-foreground text-lg mt-1">{analysis.corners.length}</p>
               </div>
               <div>
                  <span className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Avg Time Loss / Lap</span>
                  <p className="font-mono font-bold text-apex-yellow text-lg mt-1">{gap.toFixed(2)}s</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {coaching_report?.executive_summary && (
        <div className="apex-card p-8 border-primary/20 bg-gradient-to-br from-card to-secondary/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="relative z-10">
            <h3 className="font-display text-sm tracking-widest text-primary mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              AI EXECUTIVE PERFORMANCE DEBRIEF
            </h3>
            <p className="font-body text-xl text-foreground leading-relaxed">
              {coaching_report.executive_summary}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-6 border-t border-border/50">
               <div>
                 <span className="text-[10px] text-muted-foreground font-display uppercase tracking-widest block mb-1">Driving Style</span>
                 <p className="font-body text-foreground">
                   {coaching_report.driver_profile_interpretation?.driving_style_observations?.[0] || "Consistency-focused"}
                 </p>
               </div>
               <div>
                 <span className="text-[10px] text-muted-foreground font-display uppercase tracking-widest block mb-1">Coach Priority</span>
                 <p className="font-body text-foreground">
                   {coaching_report.driver_profile_interpretation?.priority_focus?.[0] || "Late apex entry"}
                 </p>
               </div>
               <div>
                 <span className="text-[10px] text-muted-foreground font-display uppercase tracking-widest block mb-1">Confidence Impact</span>
                 <p className="font-body text-foreground">
                   High in low-speed sections
                 </p>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CornersTab = ({
  analysis,
  track,
  heatmap,
}: {
  analysis: AnalysisResult;
  track: TrackData | null;
  heatmap: HeatmapData | null;
}) => {
  const reports = analysis.coaching_report?.corner_reports || [];
  const [hoveredCorner, setHoveredCorner] = useState<string | null>(null);
  const [expandedCorner, setExpandedCorner] = useState<string | null>(null);

  const norm = useMemo(() => buildNorm(track, heatmap), [track, heatmap]);

  if (!reports.length) {
    return <div className="p-4 text-muted-foreground">No detailed corner reports available.</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Mistake List */}
      <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
        <h3 className="text-xs font-display tracking-widest text-muted-foreground uppercase mb-2">TOP 5 COACHING PRIORITIES</h3>
        {reports
          .sort((a, b) => a.priority - b.priority)
          .slice(0, 5)
          .map((r, i) => {
             const isHovered = hoveredCorner === r.corner;
             const isExpanded = expandedCorner === r.corner;
             return (
              <div
                key={i}
                onMouseEnter={() => setHoveredCorner(r.corner)}
                onMouseLeave={() => setHoveredCorner(null)}
                onClick={() => setExpandedCorner(isExpanded ? null : r.corner)}
                className={`apex-card p-5 flex flex-col gap-3 transition-all duration-300 border-l-4 cursor-pointer hover:bg-secondary/20 ${
                  isHovered || isExpanded ? "border-l-primary bg-secondary/30" : "border-l-transparent"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-display uppercase tracking-widest text-foreground flex items-center gap-2">
                       {r.corner}
                       <span className="text-xs text-muted-foreground font-mono">{isExpanded ? '[-]' : '[+]'}</span>
                    </h3>
                    <h4 className="text-xs font-body text-destructive font-bold mt-0.5">{r.headline}</h4>
                  </div>
                  <span className="font-mono text-lg text-primary font-bold">{r.time_gain}</span>
                </div>
                
                {!isExpanded && (
                   <>
                     <p className="font-body text-foreground text-sm leading-relaxed line-clamp-2">{r.detail}</p>
                     <div className="mt-2 text-[10px] uppercase font-display tracking-widest text-accent flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                        Hover to locate on map / Click for details
                     </div>
                   </>
                )}

                {/* Expanded State Details */}
                {isExpanded && (
                   <div className="mt-2 flex flex-col gap-4 animate-fade-in border-t border-border/50 pt-4">
                     <div>
                       <span className="text-[10px] uppercase font-display tracking-widest text-muted-foreground block mb-1">What's Happening</span>
                       <p className="font-body text-foreground text-sm leading-relaxed">{r.detail}</p>
                     </div>
                     <div>
                       <span className="text-[10px] uppercase font-display tracking-widest text-apex-yellow block mb-1">Root Cause</span>
                       <p className="font-body text-foreground text-sm leading-relaxed">{r.root_cause}</p>
                     </div>
                     <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
                       <span className="text-[10px] uppercase font-display tracking-widest text-primary font-bold block mb-1">Instruction</span>
                       <p className="font-body text-foreground text-sm font-semibold">{r.instruction}</p>
                     </div>
                     <div className="flex flex-col gap-3 mt-1">
                       <div className="flex items-start gap-2">
                          <span className="text-accent mt-0.5 text-xs">✓</span>
                          <div>
                            <span className="text-[10px] uppercase font-display tracking-widest text-muted-foreground block">What to Feel</span>
                            <p className="font-body text-xs text-foreground mt-0.5">{r.what_to_feel}</p>
                          </div>
                       </div>
                       <div className="flex items-start gap-2">
                          <span className="text-destructive mt-0.5 text-xs">✗</span>
                          <div>
                            <span className="text-[10px] uppercase font-display tracking-widest text-muted-foreground block">Mistake to Avoid</span>
                            <p className="font-body text-xs text-foreground mt-0.5">{r.common_mistake_to_avoid}</p>
                          </div>
                       </div>
                     </div>
                   </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Right Column: Heatmap Map */}
      <div className="lg:col-span-8 sticky top-4">
        <div className="apex-card p-6 border-accent/20">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-display uppercase tracking-widest text-foreground">Interactive Session Heatmap</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 rounded-full" style={{ background: "linear-gradient(to right, rgb(0,200,0), rgb(255,200,0), rgb(255,0,0))" }} />
              <span className="text-[10px] font-mono text-muted-foreground">Off Pace</span>
            </div>
          </div>

          <div className="relative aspect-video">
            {!norm ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground animate-pulse">Loading map data...</p>
              </div>
            ) : (
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full drop-shadow-2xl">
                {/* Track borders */}
                <polyline
                  points={norm.leftPts}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-40"
                />
                <polyline
                  points={norm.rightPts}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-40"
                />
                
                {/* Heatmap dots */}
                {norm.hmPts.map((p, i) => {
                  let isActive = false;
                  const targetCorner = hoveredCorner || expandedCorner;
                  if (targetCorner && track?.segments) {
                    const segment = track.segments.find((s: any) => s.name === targetCorner);
                    if (segment) {
                       const ratio = i / norm.hmPts.length;
                       const startRatio = (segment as any).dist_start / track.track_length_m;
                       const endRatio = (segment as any).dist_end / track.track_length_m;
                       // Wrap-around logic for segments crossing start/finish line
                       if (startRatio > endRatio) {
                          isActive = ratio >= startRatio || ratio <= endRatio;
                       } else {
                          isActive = ratio >= startRatio && ratio <= endRatio;
                       }
                    }
                  }
                  
                  return (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={targetCorner ? (isActive ? 8 : 2) : 5}
                      fill={p.color}
                      className="transition-all duration-300"
                      opacity={targetCorner ? (isActive ? 1 : 0.1) : 0.8}
                    />
                  );
                })}
              </svg>
            )}
          </div>
          {(hoveredCorner || expandedCorner) && (
             <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-md animate-fade-in flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-xs font-display uppercase tracking-widest text-primary font-bold">Highlighting: {hoveredCorner || expandedCorner}</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Inputs Tab removed as per request

const RecommendationsTab = ({ analysis }: { analysis: AnalysisResult }) => {
  const profile = analysis.coaching_report?.driver_profile_interpretation;
  return (
  <div className="flex flex-col gap-8 w-full pb-10">
    
    {/* Full width AI summary */}
    {analysis.coaching_report?.executive_summary && (
      <div className="apex-card p-8 border-accent/30 bg-gradient-to-br from-card to-accent/5">
        <h3 className="font-display text-sm tracking-widest text-accent mb-4 flex items-center gap-2">
           <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
           COMPREHENSIVE COACH ANALYSIS
        </h3>
        <p className="font-body text-foreground text-xl leading-relaxed">
          {analysis.coaching_report.executive_summary}
        </p>
      </div>
    )}

    {profile && (
       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <div className="apex-card p-6 border-primary/30 bg-primary/5">
           <h3 className="font-display text-sm tracking-wider text-primary mb-4 border-b border-primary/20 pb-2">MAIN STRENGTHS</h3>
           <ul className="list-disc pl-5 text-foreground font-body space-y-3">
              {profile.main_strengths.map((s,i) => <li key={i}>{s}</li>)}
           </ul>
         </div>
         <div className="apex-card p-6 border-destructive/30 bg-destructive/5">
           <h3 className="font-display text-sm tracking-wider text-destructive mb-4 border-b border-destructive/20 pb-2">MAIN WEAKNESSES</h3>
           <ul className="list-disc pl-5 text-foreground font-body space-y-3">
              {profile.main_weaknesses.map((s,i) => <li key={i}>{s}</li>)}
           </ul>
         </div>
         <div className="apex-card p-6 border-apex-yellow/30 bg-apex-yellow/5">
           <h3 className="font-display text-sm tracking-wider text-apex-yellow mb-4 border-b border-apex-yellow/20 pb-2">PRIORITY FOCUS</h3>
           <ul className="list-disc pl-5 text-foreground font-body space-y-3">
              {profile.priority_focus?.map((s,i) => <li key={i}>{s}</li>) || <li className="text-muted-foreground">None specified</li>}
           </ul>
         </div>
         <div className="apex-card p-6 border-foreground/30 bg-secondary/20">
           <h3 className="font-display text-sm tracking-wider text-foreground mb-4 border-b border-border/50 pb-2">DRIVING STYLE</h3>
           <ul className="list-disc pl-5 text-foreground font-body space-y-3">
              {profile.driving_style_observations?.map((s,i) => <li key={i}>{s}</li>) || <li className="text-muted-foreground">General observations</li>}
           </ul>
         </div>
       </div>
    )}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {analysis.coaching_report?.biggest_time_opportunities && analysis.coaching_report.biggest_time_opportunities.length > 0 && (
        <div className="apex-card p-8 border-apex-yellow/20 flex flex-col h-full">
          <h3 className="font-display text-sm tracking-wider text-apex-yellow mb-6 border-b border-border/50 pb-2">BIGGEST TIME OPPORTUNITIES</h3>
          <div className="flex flex-col gap-6 flex-1">
            {analysis.coaching_report.biggest_time_opportunities.map((opp, idx) => (
              <div key={idx} className="flex flex-col gap-3 group">
                 <div className="flex justify-between items-start">
                    <h4 className="text-foreground font-display text-lg tracking-wider group-hover:text-primary transition-colors">{opp.theme}</h4>
                    <span className="text-primary font-mono text-lg font-bold bg-primary/10 px-3 py-1 rounded">~{opp.estimated_total_gain_s}s</span>
                 </div>
                 <p className="text-muted-foreground text-xs font-display uppercase tracking-widest">Corners: <span className="text-foreground">{opp.corners_affected.join(", ")}</span></p>
                 <p className="text-foreground font-body leading-relaxed">{opp.why_it_matters}</p>
                 {idx < analysis.coaching_report.biggest_time_opportunities.length - 1 && <div className="border-b border-border/50 mt-4" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.coaching_report?.next_session_focus && analysis.coaching_report.next_session_focus.length > 0 && (
        <div className="apex-card p-8 border-accent/20 flex flex-col h-full">
          <h3 className="font-display text-sm tracking-wider text-accent mb-6 border-b border-border/50 pb-2">NEXT SESSION DRILLS</h3>
          <div className="flex flex-col gap-6 flex-1">
            {analysis.coaching_report.next_session_focus.map((focus, idx) => (
               <div key={idx} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-md bg-accent text-accent-foreground flex items-center justify-center font-display text-lg shadow-lg shadow-accent/20">{idx + 1}</div>
                     <h4 className="font-display text-lg tracking-wider text-foreground">{focus.title}</h4>
                  </div>
                  <p className="font-body text-muted-foreground leading-relaxed ml-11">{focus.why}</p>
                  <div className="bg-secondary/40 p-4 rounded-md border-l-4 border-primary ml-11 mt-1">
                    <span className="text-[10px] uppercase font-display tracking-widest text-primary block mb-1">Specific Drill</span>
                    <p className="font-mono text-sm text-foreground">{focus.drill}</p>
                  </div>
                  {idx < analysis.coaching_report.next_session_focus.length - 1 && <div className="border-b border-border/50 mt-4 ml-11" />}
               </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
)};

const SVG_W = 560;
const SVG_H = 560;
const PAD = 40;

function buildNorm(track: TrackData | null, heatmap: HeatmapData | null) {
  if (!track || !heatmap) return null;
  const allX = [...track.left_border.map(p => p[0]), ...track.right_border.map(p => p[0])];
  const allY = [...track.left_border.map(p => p[1]), ...track.right_border.map(p => p[1])];
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = Math.min((SVG_W - PAD * 2) / rangeX, (SVG_H - PAD * 2) / rangeY);
  const offX = PAD + ((SVG_W - PAD * 2) - rangeX * scale) / 2;
  const offY = PAD + ((SVG_H - PAD * 2) - rangeY * scale) / 2;
  const toSVG = (wx: number, wy: number) => ({
    x: offX + (wx - minX) * scale,
    y: offY + (maxY - wy) * scale,
  });
  const leftPts = track.left_border.map(p => toSVG(p[0], p[1]));
  const rightPts = track.right_border.map(p => toSVG(p[0], p[1]));
  const toPolyline = (pts: { x: number; y: number }[]) =>
    pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const maxLoss = Math.max(...heatmap.time_loss, 0.001);
  const hmPts = heatmap.x.map((wx, i) => {
    const { x, y } = toSVG(wx, heatmap.y[i]);
    const t = Math.min(heatmap.time_loss[i] / maxLoss, 1);
    // interpolate green → yellow → red
    const r = Math.round(t < 0.5 ? (t * 2 * 255) : 255);
    const g = Math.round(t < 0.5 ? 200 : (1 - (t - 0.5) * 2) * 200);
    const color = `rgb(${r},${g},0)`;
    return { x, y, color, loss: heatmap.time_loss[i] };
  });
  return { leftPts: toPolyline(leftPts), rightPts: toPolyline(rightPts), hmPts };
}

// Heatmap Tab removed as per request (Heatmap moved inside Corners)

const PostAnalysis = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Overview");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [track, setTrack] = useState<TrackData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAnalysis(), fetchTrackData(), fetchHeatmap()])
      .then(([a, t, h]) => {
        setAnalysis(a);
        setTrack(t);
        setHeatmap(h);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body text-lg">Generating analysis...</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive font-body text-lg">Failed to load: {error}</p>
      </div>
    );
  }

  const tabContent: Record<string, React.ReactNode> = {
    Overview: <OverviewTab analysis={analysis} />,
    Corners: <CornersTab analysis={analysis} track={track} heatmap={heatmap} />,
    Recommendations: <RecommendationsTab analysis={analysis} />,
  };

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain" />
          <div>
            <h2 className="text-3xl font-bold tracking-wider text-foreground">Post Analysis</h2>
            <p className="text-muted-foreground font-body text-lg">
              Yas Marina — {formatLapTime(analysis.session.user_lap_time_s)} best — {analysis.corners.length} corners
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate("/summary")} className="apex-btn-secondary uppercase tracking-wider text-sm">Summary</button>
          <button onClick={() => navigate("/replay")} className="apex-btn-secondary uppercase tracking-wider text-sm">Replay</button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-secondary/50 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-md font-display text-xs tracking-wider uppercase transition-all ${
              activeTab === tab
                ? "bg-card text-foreground shadow-lg"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 animate-fade-in" key={activeTab}>
        {tabContent[activeTab]}
      </div>
    </div>
  );
};

export default PostAnalysis;
