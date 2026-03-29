import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  trend?: number;
  className?: string;
}

export const StatCard = ({ label, value, sub, icon, trend, className = "" }: StatCardProps) => (
  <div className={`apex-card flex flex-col gap-1 ${className}`}>
    <div className="flex items-center justify-between">
      <span className="stat-label">{label}</span>
      {icon && <span className="text-muted-foreground">{icon}</span>}
    </div>
    <div className="flex items-end gap-1.5">
      <span className="stat-number">{value}</span>
      {trend !== undefined && trend !== 0 && (
        <span className={`mb-0.5 text-xs font-semibold ${trend > 0 ? "text-apex-green" : "text-apex-red"}`}>
          {trend > 0 ? "+" : ""}{trend}
        </span>
      )}
    </div>
    {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
  </div>
);
