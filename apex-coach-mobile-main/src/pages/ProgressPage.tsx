import { MobileLayout } from "@/components/MobileLayout";
import { SkillBar } from "@/components/SkillBar";
import { driver, skills, badges } from "@/data/mockData";
import { Star, Flame, Trophy, Lock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ProgressPage() {
  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);

  return (
    <MobileLayout>
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="font-display text-2xl font-bold">Progress</h1>

        {/* Driver level */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="apex-card-glow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-apex-purple/15 p-2">
                <Star size={20} className="text-apex-purple glow-purple" />
              </div>
              <div>
                <span className="font-display text-lg font-bold">Level {driver.level}</span>
                <p className="text-xs text-muted-foreground">{driver.rank}</p>
              </div>
            </div>
            <span className="font-mono text-sm text-muted-foreground">{driver.xp} / {driver.xpNext} XP</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-apex-purple transition-all duration-1000" style={{ width: `${(driver.xp / driver.xpNext) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{driver.xpNext - driver.xp} XP to Level {driver.level + 1}</p>
        </motion.div>

        {/* Streaks */}
        <div className="grid grid-cols-3 gap-3">
          <div className="apex-card text-center">
            <Flame size={18} className="mx-auto text-apex-yellow" />
            <span className="font-mono text-lg font-bold mt-1">{driver.streak}</span>
            <p className="text-[10px] text-muted-foreground">Day Streak</p>
          </div>
          <div className="apex-card text-center">
            <CheckCircle2 size={18} className="mx-auto text-apex-green" />
            <span className="font-mono text-lg font-bold mt-1">3</span>
            <p className="text-[10px] text-muted-foreground">Clean Laps</p>
          </div>
          <div className="apex-card text-center">
            <Trophy size={18} className="mx-auto text-apex-purple" />
            <span className="font-mono text-lg font-bold mt-1">{earnedBadges.length}</span>
            <p className="text-[10px] text-muted-foreground">Badges</p>
          </div>
        </div>

        {/* Core skills */}
        <div className="apex-card flex flex-col gap-3">
          <span className="stat-label">Core Skills</span>
          {skills.map((s) => (
            <SkillBar key={s.name} name={s.name} score={s.score} change={s.change} />
          ))}
        </div>

        {/* Achievements earned */}
        <div className="flex flex-col gap-2">
          <span className="stat-label px-1">Achievements Earned</span>
          <div className="grid grid-cols-2 gap-3">
            {earnedBadges.map((b, i) => (
              <motion.div
                key={b.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="apex-card flex items-center gap-3 border-apex-purple/20"
              >
                <div className="rounded-lg bg-apex-purple/15 p-2">
                  <Trophy size={16} className="text-apex-purple" />
                </div>
                <div>
                  <p className="text-xs font-medium">{b.name}</p>
                  <p className="text-[10px] text-muted-foreground">{b.date}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Locked achievements */}
        <div className="flex flex-col gap-2">
          <span className="stat-label px-1">Next Achievements</span>
          <div className="grid grid-cols-2 gap-3">
            {lockedBadges.map((b) => (
              <div key={b.name} className="apex-card flex items-center gap-3 opacity-50">
                <div className="rounded-lg bg-secondary p-2">
                  <Lock size={16} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium">{b.name}</p>
                  <p className="text-[10px] text-muted-foreground">Locked</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-2" />
      </div>
    </MobileLayout>
  );
}
