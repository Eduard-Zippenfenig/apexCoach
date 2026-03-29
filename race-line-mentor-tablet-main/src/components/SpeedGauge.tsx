const SpeedGauge = ({ speed, max }: { speed: number; max: number }) => {
  const pct = Math.min(speed / max, 1);
  const radius = 110;
  const stroke = 12;
  const startAngle = 135;
  const endAngle = 405;
  const range = endAngle - startAngle;
  const currentAngle = startAngle + range * pct;

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (cx: number, cy: number, r: number, start: number, end: number) => {
    const s = polarToCartesian(cx, cy, r, start);
    const e = polarToCartesian(cx, cy, r, end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const cx = 130, cy = 130;

  const arcColor =
    speed > 200 ? "hsl(var(--apex-red))" :
    speed > 120 ? "hsl(var(--apex-yellow))" :
    "hsl(var(--apex-green))";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="280" height="280" viewBox="0 0 260 260">
        <path
          d={describeArc(cx, cy, radius, startAngle, endAngle)}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={describeArc(cx, cy, radius, startAngle, currentAngle)}
          fill="none"
          stroke={arcColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${arcColor})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="text-7xl font-display font-bold text-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {speed}
        </span>
        <span className="text-sm font-body text-muted-foreground uppercase tracking-widest">
          KM/H
        </span>
      </div>
    </div>
  );
};

export default SpeedGauge;
