import { MobileLayout } from "@/components/MobileLayout";
import { sessions, Session } from "@/data/mockData";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Share2, Bookmark, Timer, Gauge, Target, Zap, TrendingUp, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const session = useMemo(() => {
    const lastSessionRaw = localStorage.getItem("apexcoach_last_session");
    if (lastSessionRaw && id === "last-synced") {
      try {
        const parsed = JSON.parse(lastSessionRaw);
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
          recommendations: (parsed.coaching_report?.next_session_focus || []).map((f: any) => f.title),
          sectors: [
             { sector: 1, time: "28.5", delta: "+0.2", best: false },
             { sector: 2, time: "25.2", delta: "-0.1", best: true },
             { sector: 3, time: "27.2", delta: "+0.8", best: false },
          ],
          lapTimes: [parsed.lap_time_s ? `${Math.floor(parsed.lap_time_s / 60)}:${(parsed.lap_time_s % 60).toFixed(1)}` : "1:20.5"],
          weather: "Clear, 28°C",
          track: parsed.track || "Yas Marina Circuit",
          car: parsed.car || "Porsche GT3",
          tyres: "Slicks",
          mode: "Push"
        } as Session;
      } catch (e) {
        console.error(e);
      }
    }
    return sessions.find((s) => s.id === id) as Session | undefined;
  }, [id]);

  if (!session) return <MobileLayout><div className="p-6 text-center text-muted-foreground">Session not found</div></MobileLayout>;

  const lapData = session.lapTimes.map((t, i) => ({
    lap: `L${i + 1}`,
    time: parseFloat(t.replace(":", "")),
    raw: t,
  }));
  const bestLapTime = Math.min(...lapData.map((l) => l.time));

  return (
    <MobileLayout>
      <div className="flex flex-col gap-4 px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-secondary">
              <ArrowLeft size={20} />
            </button>
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg p-2 hover:bg-secondary"><Share2 size={18} /></button>
            <button className="rounded-lg p-2 hover:bg-secondary"><Bookmark size={18} /></button>
          </div>
        </div>

        {/* Session title */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold">{session.track}</h1>
          <p className="text-sm text-muted-foreground">{session.date} · {session.time} · {session.weather}</p>
          <div className="mt-2 flex gap-2">
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{session.car}</span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{session.tyres}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${session.mode === "Push" ? "bg-apex-red/15 text-apex-red" : "bg-apex-blue/15 text-apex-blue"}`}>
              {session.mode}
            </span>
          </div>
        </motion.div>

        {/* Best lap hero */}
        <div className="apex-card-glow text-center">
          <span className="stat-label">Best Lap</span>
          <div className="font-mono text-4xl font-bold text-primary mt-1">{session.bestLap}</div>
          <p className="mt-1 text-xs text-muted-foreground">Reference: {session.referenceLap} · Delta: +{(parseFloat(session.bestLap.replace(":", "")) - parseFloat(session.referenceLap.replace(":", ""))).toFixed(1)}s</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Avg Lap", value: session.avgLap, icon: <Timer size={14} /> },
            { label: "Laps", value: session.totalLaps, icon: <Target size={14} /> },
            { label: "Consistency", value: `${session.consistency}%`, icon: <TrendingUp size={14} /> },
          ].map((s) => (
            <div key={s.label} className="apex-card text-center flex flex-col items-center gap-1">
              <span className="text-muted-foreground">{s.icon}</span>
              <span className="font-mono text-lg font-bold">{s.value}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Braking", value: session.brakingScore, icon: <Gauge size={14} /> },
            { label: "Exit Speed", value: session.exitScore, icon: <Zap size={14} /> },
            { label: "Smoothness", value: session.smoothness, icon: <TrendingUp size={14} /> },
            { label: "Corner Entry", value: session.cornerEntry, icon: <Target size={14} /> },
          ].map((s) => (
            <div key={s.label} className="apex-card flex items-center gap-3">
              <div className="rounded-lg bg-secondary p-2 text-muted-foreground">{s.icon}</div>
              <div>
                <span className="font-mono text-lg font-bold">{s.value}</span>
                <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Lap chart */}
        <div className="apex-card">
          <span className="stat-label">Lap Times</span>
          <div className="mt-3 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lapData}>
                <XAxis dataKey="lap" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} axisLine={false} tickLine={false} />
                <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.3"]} />
                <Bar dataKey="time" radius={[4, 4, 0, 0]}>
                  {lapData.map((entry) => (
                    <Cell key={entry.lap} fill={entry.time === bestLapTime ? "hsl(142, 71%, 40%)" : "hsl(220, 14%, 90%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sectors */}
        {session.sectors.length > 0 && (
          <div className="apex-card">
            <span className="stat-label">Sector Splits</span>
            <div className="mt-3 flex flex-col gap-2">
              {session.sectors.map((sec) => (
                <div key={sec.sector} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                  <span className="text-sm font-medium">Sector {sec.sector}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold">{sec.time}s</span>
                    <span className={`font-mono text-xs font-bold ${sec.delta.startsWith("-") ? "text-apex-green" : "text-apex-red"}`}>
                      {sec.delta}s
                    </span>
                    {sec.best && <span className="text-[10px] text-apex-purple font-bold">PB</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strengths & Mistakes */}
        <div className="grid grid-cols-1 gap-3">
          <div className="apex-card">
            <span className="stat-label text-apex-green">Strengths</span>
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
            <span className="stat-label text-apex-red">Areas to Improve</span>
            <ul className="mt-2 flex flex-col gap-1.5">
              {session.mistakes.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-apex-red" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Coach summary */}
        <div className="apex-card border-l-2 border-l-apex-blue">
          <span className="stat-label text-apex-blue">Coach Summary</span>
          <p className="mt-2 text-sm leading-relaxed text-secondary-foreground">{session.coachSummary}</p>
        </div>

        {/* Full analysis CTA */}
        <button
          onClick={() => navigate(`/sessions/${session.id}/analysis`)}
          className="apex-card-glow flex items-center justify-between"
        >
          <div>
            <span className="font-display text-sm font-bold">Full Post Analysis</span>
            <p className="text-xs text-muted-foreground">Sectors, corners, inputs & replay</p>
          </div>
          <ChevronRight size={18} className="text-primary" />
        </button>

        <div className="h-2" />
      </div>
    </MobileLayout>
  );
}
