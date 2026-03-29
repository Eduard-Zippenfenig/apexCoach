interface SkillBarProps {
  name: string;
  score: number;
  change: number;
  maxScore?: number;
}

export const SkillBar = ({ name, score, change, maxScore = 100 }: SkillBarProps) => {
  const pct = (score / maxScore) * 100;
  const color = score >= 75 ? "bg-apex-green" : score >= 50 ? "bg-apex-yellow" : "bg-apex-red";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{name}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm font-bold">{score}</span>
          {change !== 0 && (
            <span className={`text-xs font-semibold ${change > 0 ? "text-apex-green" : "text-apex-red"}`}>
              {change > 0 ? "▲" : "▼"}{Math.abs(change)}
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
