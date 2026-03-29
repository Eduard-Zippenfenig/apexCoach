import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAnalysis, formatLapTime, type AnalysisResult } from "@/lib/api";

const ScoreBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground font-display uppercase tracking-widest">{label}</span>
      <span className="text-sm font-mono font-bold" style={{ color }}>{value}</span>
    </div>
    <div className="h-2 bg-secondary rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

const SessionSummary = () => {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  const [realDataReady, setRealDataReady] = useState(false);

  const loadingMessages = [
    "Fetching high-frequency telemetry data...",
    "Identifying corner entry patterns...",
    "Processing corner-by-corner performance...",
    "AI Race Engineer crunching the data...",
    "Formulating driver profile and focus areas...",
    "Finalizing elite debrief report..."
  ];

  useEffect(() => {
    // Start message cycling
    const interval = setInterval(() => {
      setLoadingStage(prev => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
    }, 2000);

    // Enforce 12 second minimum wait for "WOW" factor
    const timer = setTimeout(() => {
      setRealDataReady(true);
    }, 12000);

    fetchAnalysis()
      .then((data) => {
        setAnalysis(data);
        const userRaw = localStorage.getItem("apexcoach_user");
        if (userRaw && userRaw !== "undefined") {
          try {
            const user = JSON.parse(userRaw);
            if (user && user.id) {
              const sessionPayload = {
                track: "Yas Marina Circuit",
                lap_time_s: data.session.user_lap_time_s,
                ref_lap_time_s: data.session.ref_lap_time_s,
                gap_s: data.session.total_time_gap_s,
                scores: data.overall_scores,
                summary: "Session complete",
                corners: data.corners.map((c: any) => ({ 
                  corner_name: c.corner_name, 
                  estimated_time_loss_s: c.estimated_time_loss_s, 
                  primary_issue: c.primary_issue 
                })),
                coaching_report: data.coaching_report,
              };
              fetch(`/api/users/${user.id}/sessions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(sessionPayload)
              });
            }
          } catch (e) {
            console.error("Failed to save session", e);
          }
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        // We only stop loading when both data is here AND the 12s timer is up
      });

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  // Final check to see if we can show the UI
  useEffect(() => {
    if (realDataReady && (analysis || error)) {
      setLoading(false);
    }
  }, [realDataReady, analysis, error]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Animated background glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-accent/10 rounded-full blur-[80px]" />
        
        <div className="relative z-10 flex flex-col items-center gap-12 max-w-2xl w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-primary/20 rounded-full" />
              <div className="absolute inset-0 w-24 h-24 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-4 border-2 border-accent/20 rounded-full animate-reverse-spin" />
            </div>
            <h2 className="text-3xl font-display font-bold tracking-[0.2em] text-foreground mt-4">APEX ENGINE</h2>
          </div>

          <div className="w-full space-y-4">
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${((loadingStage + 1) / loadingMessages.length) * 100}%` }}
              />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-primary font-mono text-sm tracking-widest uppercase animate-pulse">
                {loadingMessages[loadingStage]}
              </p>
              <p className="text-muted-foreground font-body text-xs opacity-60">
                Phase {loadingStage + 1} of {loadingMessages.length}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8 w-full opacity-40">
            {["TELEMETRY", "CORNERING", "VIRTUAL COACH"].map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className={`h-1 w-full rounded-full ${i <= Math.floor(loadingStage/2) ? 'bg-primary' : 'bg-muted'}`} />
                <span className="text-[10px] font-display tracking-widest">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive font-body text-lg">Failed to load analysis: {error}</p>
      </div>
    );
  }

  const { session, overall_scores, top_3_improvements, corners, coaching_report } = analysis;
  const bestLap = formatLapTime(session.user_lap_time_s);
  const refLap  = formatLapTime(session.ref_lap_time_s);
  const gap     = session.total_time_gap_s;
  const gapStr  = `+${gap.toFixed(2)}s`;
  const today   = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const improvements = coaching_report?.next_session_focus?.length
    ? coaching_report.next_session_focus
    : top_3_improvements.map((t) => ({ title: t.suggestion }));

  // Top 3 corners by time loss
  const topCorners = [...corners].sort((a, b) => b.estimated_time_loss_s - a.estimated_time_loss_s).slice(0, 3);
  const maxLoss = topCorners[0]?.estimated_time_loss_s ?? 1;

  const scoreColors: Record<string, string> = {
    braking:    "hsl(var(--apex-green))",
    line:       "hsl(var(--apex-blue))",
    throttle:   "hsl(var(--primary))",
    smoothness: "hsl(var(--accent))",
  };

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col gap-6">

      {/* ── Hero banner ── */}
      <div className="apex-card border-primary/30 p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
            <div>
              <p className="text-xs text-muted-foreground font-display uppercase tracking-widest mb-1">Session Complete</p>
              <h1 className="text-4xl font-display font-bold text-foreground tracking-wider">YAS MARINA CIRCUIT</h1>
              <p className="text-muted-foreground font-body mt-1">{today}</p>
            </div>
          </div>

          {/* Big lap time comparison */}
          <div className="flex items-end gap-8">
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-display uppercase tracking-widest mb-1">Your Best</p>
              <p className="text-6xl font-mono font-bold text-primary apex-text-glow-green" style={{ fontVariantNumeric: "tabular-nums" }}>
                {bestLap}
              </p>
            </div>
            <div className="text-center pb-1">
              <p className="text-3xl font-mono font-bold text-destructive" style={{ fontVariantNumeric: "tabular-nums" }}>{gapStr}</p>
              <p className="text-xs text-muted-foreground font-body mt-1">gap to ref</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-display uppercase tracking-widest mb-1">Reference</p>
              <p className="text-4xl font-mono font-bold text-accent" style={{ fontVariantNumeric: "tabular-nums" }}>{refLap}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Scores */}
        <div className="apex-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-display tracking-widest text-muted-foreground uppercase">Performance Scores</h3>
          {Object.entries(overall_scores).map(([key, val]) => (
            <ScoreBar
              key={key}
              label={key}
              value={val}
              color={scoreColors[key] ?? "hsl(var(--foreground))"}
            />
          ))}
          <div className="mt-2 pt-3 border-t border-border flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-display uppercase tracking-widest">Consistency</span>
            <span className="text-lg font-mono font-bold text-foreground">{session.consistency_score}%</span>
          </div>
        </div>

        {/* Top corners / time loss */}
        <div className="apex-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-display tracking-widest text-muted-foreground uppercase">Biggest Time Losses</h3>
          {topCorners.map((c, i) => (
            <div key={c.corner_name} className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-display text-foreground tracking-wide">{c.corner_name}</span>
                <span className="text-sm font-mono font-bold text-destructive">+{c.estimated_time_loss_s.toFixed(2)}s</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(c.estimated_time_loss_s / maxLoss) * 100}%`,
                    backgroundColor: i === 0 ? "hsl(var(--destructive))" : i === 1 ? "hsl(var(--apex-yellow))" : "hsl(var(--muted-foreground))",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground font-body capitalize">{c.primary_issue.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>

        {/* Focus areas */}
        <div className="apex-card p-6 flex flex-col gap-4">
          <h3 className="text-xs font-display tracking-widest text-apex-yellow uppercase">Focus for Next Session</h3>
          {improvements.slice(0, 3).map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-primary-foreground mt-0.5 ${
                i === 0 ? "bg-destructive" : i === 1 ? "bg-primary" : "bg-apex-yellow"
              }`}>
                {i + 1}
              </div>
              <p className="font-body text-sm text-foreground leading-relaxed">{s.title || String(s)}</p>
            </div>
          ))}

          {top_3_improvements[0] && (
            <div className="mt-auto pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Weakest corner</p>
              <p className="text-sm font-display text-destructive tracking-wide mt-0.5">{analysis.weakest_section}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Coach summary ── */}
      <div className="apex-card border-accent/40 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-display tracking-widest text-accent uppercase mb-2">AI Coach Summary</p>
            <p className="font-body text-lg text-foreground leading-relaxed">
              {coaching_report?.executive_summary ?? `Session complete. ${gap.toFixed(1)}s gap to reference. Review the analysis for a full breakdown.`}
            </p>
            {coaching_report?.biggest_time_opportunities?.[0] && (
              <p className="font-body text-base text-muted-foreground leading-relaxed mt-2">
                <span className="text-primary font-semibold">Biggest win available: </span>
                {coaching_report.biggest_time_opportunities[0].why_it_matters}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-center flex-wrap">
        <button onClick={() => navigate("/analysis")} className="apex-btn-primary uppercase tracking-widest px-8">
          Full Analysis
        </button>
        <button onClick={() => navigate("/replay")} className="apex-btn-secondary uppercase tracking-wider">
          Replay Laps
        </button>
        <button onClick={() => navigate("/sync")} className="apex-btn-secondary uppercase tracking-wider">
          Sync to Phone
        </button>
        <button onClick={() => navigate("/")} className="apex-btn-secondary uppercase tracking-wider">
          New Session
        </button>
      </div>
    </div>
  );
};

export default SessionSummary;
