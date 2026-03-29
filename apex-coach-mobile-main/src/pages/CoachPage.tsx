import { MobileLayout } from "@/components/MobileLayout";
import { recommendations, skills } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, TrendingUp, Target, Brain } from "lucide-react";
import { motion } from "framer-motion";

export default function CoachPage() {
  const navigate = useNavigate();
  const bestSkill = [...skills].sort((a, b) => b.score - a.score)[0];
  const worstSkill = [...skills].sort((a, b) => a.score - b.score)[0];

  return (
    <MobileLayout>
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-secondary">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold">AI Coach</h1>
            <p className="text-xs text-muted-foreground">Personalized improvement guidance</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="apex-card border-l-2 border-l-apex-green">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={12} className="text-apex-green" />
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Strongest</span>
            </div>
            <span className="text-sm font-bold">{bestSkill.name}</span>
            <span className="font-mono text-lg font-bold text-apex-green ml-1">{bestSkill.score}</span>
          </div>
          <div className="apex-card border-l-2 border-l-apex-red">
            <div className="flex items-center gap-1.5 mb-1">
              <Target size={12} className="text-apex-red" />
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Focus Area</span>
            </div>
            <span className="text-sm font-bold">{worstSkill.name}</span>
            <span className="font-mono text-lg font-bold text-apex-red ml-1">{worstSkill.score}</span>
          </div>
        </div>

        {/* Today's recommendation */}
        <div className="apex-card-glow border-l-2 border-l-primary">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={16} className="text-primary" />
            <span className="stat-label text-primary">Today's Focus</span>
          </div>
          <h3 className="text-sm font-bold mb-1">{recommendations[0].title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{recommendations[0].description}</p>
        </div>

        {/* All recommendations */}
        <span className="stat-label px-1">Coach Cards</span>
        <div className="flex flex-col gap-3">
          {recommendations.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="apex-card"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-lg p-2 ${r.priority === "high" ? "bg-apex-red/15" : r.priority === "medium" ? "bg-apex-yellow/15" : "bg-apex-green/15"}`}>
                  <Zap size={14} className={r.priority === "high" ? "text-apex-red" : r.priority === "medium" ? "text-apex-yellow" : "text-apex-green"} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold">{r.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                  <div className="mt-2 flex gap-2">
                    {r.skill && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{r.skill}</span>}
                    {r.track && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{r.track}</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Suggested next session */}
        <div className="apex-card">
          <span className="stat-label">Suggested Next Session</span>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Track</span><span className="font-medium">Yas Marina</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span className="font-medium">Push</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Focus</span><span className="font-medium text-apex-red">Sector 3 Exits</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Goal</span><span className="font-medium text-primary">Break 1:19.0</span></div>
          </div>
        </div>

        <div className="h-2" />
      </div>
    </MobileLayout>
  );
}
