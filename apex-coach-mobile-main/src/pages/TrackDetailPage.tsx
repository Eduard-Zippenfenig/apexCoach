import { MobileLayout } from "@/components/MobileLayout";
import { ProgressRing } from "@/components/ProgressRing";
import { SkillBar } from "@/components/SkillBar";
import { tracks } from "@/data/mockData";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Trophy, TrendingUp } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis } from "recharts";
import { motion } from "framer-motion";

export default function TrackDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const track = tracks.find((t) => t.id === id);

  if (!track || track.sessions === 0) return <MobileLayout><div className="p-6 text-center text-muted-foreground">Track not found</div></MobileLayout>;

  const trendData = track.recentTrend.map((v, i) => ({ session: `S${i + 1}`, time: v }));

  return (
    <MobileLayout>
      <div className="flex flex-col gap-4 px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-secondary">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold">{track.name}</h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={10} />
              <span>{track.country} · {track.length} · {track.turns} turns</span>
            </div>
          </div>
        </div>

        {/* Mastery hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="apex-card-glow flex items-center gap-6">
          <ProgressRing value={track.mastery} size={100} strokeWidth={7} label="Mastery" color="stroke-primary" />
          <div className="flex-1 flex flex-col gap-2">
            <div>
              <span className="stat-label">Personal Best</span>
              <div className="font-mono text-3xl font-bold text-primary">{track.personalBest}</div>
            </div>
            <div>
              <span className="stat-label">Reference Target</span>
              <div className="font-mono text-lg text-muted-foreground">{track.referenceLap}</div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="apex-card text-center">
            <span className="font-mono text-lg font-bold">{track.sessions}</span>
            <p className="text-[10px] text-muted-foreground uppercase">Sessions</p>
          </div>
          <div className="apex-card text-center">
            <span className="font-mono text-lg font-bold">{track.totalLaps}</span>
            <p className="text-[10px] text-muted-foreground uppercase">Laps</p>
          </div>
          <div className="apex-card text-center">
            <span className="font-mono text-lg font-bold">{track.turns}</span>
            <p className="text-[10px] text-muted-foreground uppercase">Turns</p>
          </div>
        </div>

        {/* Progress trend */}
        {trendData.length > 1 && (
          <div className="apex-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-primary" />
              <span className="stat-label">Lap Time Trend</span>
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <XAxis dataKey="session" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={["dataMin - 0.02", "dataMax + 0.02"]} />
                  <Line type="monotone" dataKey="time" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(142, 71%, 45%)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-apex-green font-medium">Improving trend ↗</p>
          </div>
        )}

        {/* Sector performance */}
        <div className="apex-card flex flex-col gap-3">
          <span className="stat-label">Sector Performance</span>
          {track.sectorPerformance.map((sec) => (
            <div key={sec.sector} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Sector {sec.sector}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  sec.score >= 75 ? "bg-apex-green/15 text-apex-green" : sec.score >= 50 ? "bg-apex-yellow/15 text-apex-yellow" : "bg-apex-red/15 text-apex-red"
                }`}>
                  {sec.label}
                </span>
              </div>
              <span className="font-mono text-sm font-bold">{sec.score}</span>
            </div>
          ))}
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Best: <span className="text-apex-green font-medium">Sector {track.bestSector}</span></span>
            <span>·</span>
            <span>Focus: <span className="text-apex-red font-medium">Sector {track.weakestSector}</span></span>
          </div>
        </div>

        {/* Achievements */}
        {track.achievements.length > 0 && (
          <div className="apex-card flex flex-col gap-3">
            <span className="stat-label">Track Achievements</span>
            <div className="flex gap-2">
              {track.achievements.map((a) => (
                <div key={a} className="flex items-center gap-1.5 rounded-full bg-apex-purple/10 border border-apex-purple/20 px-3 py-1.5">
                  <Trophy size={12} className="text-apex-purple" />
                  <span className="text-xs font-medium">{a}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-2" />
      </div>
    </MobileLayout>
  );
}
