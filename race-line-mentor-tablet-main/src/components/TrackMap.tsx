import { useMemo } from "react";
import {
  yasMarinaCenterline,
  yasLeftBorder,
  yasRightBorder,
  trackZones,
  TRACK_TOTAL_POINTS,
} from "@/data/trackGeometry";

interface TrackMapProps {
  /** 0–1 progress around the lap */
  carProgress: number;
  /** How many points ahead to show trajectory */
  lookahead?: number;
  /** Show reference car position (0-1) */
  refProgress?: number;
  className?: string;
  compact?: boolean;
}

const TrackMap = ({
  carProgress,
  lookahead = 30,
  refProgress,
  className = "",
  compact = false,
}: TrackMapProps) => {
  const carIdx = Math.floor(carProgress * (TRACK_TOTAL_POINTS - 1));

  // Build the polyline strings
  const leftPoly = useMemo(
    () => yasLeftBorder.map((p) => `${p[0]},${p[1]}`).join(" "),
    []
  );
  const rightPoly = useMemo(
    () => yasRightBorder.map((p) => `${p[0]},${p[1]}`).join(" "),
    []
  );
  const centerPoly = useMemo(
    () => yasMarinaCenterline.map((p) => `${p[0]},${p[1]}`).join(" "),
    []
  );

  // Build color-coded trajectory segments ahead of car
  const trajectorySegments = useMemo(() => {
    const segs: { points: string; color: string }[] = [];
    const end = Math.min(carIdx + lookahead, TRACK_TOTAL_POINTS - 1);

    let currentType = "";
    let currentPts: string[] = [];

    for (let i = carIdx; i <= end; i++) {
      const wrappedIdx = i % TRACK_TOTAL_POINTS;
      const zone = trackZones.find(
        (z) => wrappedIdx >= z.start && wrappedIdx <= z.end
      );
      const type = zone?.type || "coast";
      const color =
        type === "brake"
          ? "hsl(var(--apex-red))"
          : type === "accel"
          ? "hsl(var(--apex-green))"
          : "hsl(var(--apex-yellow))";

      if (type !== currentType && currentPts.length > 0) {
        segs.push({
          points: currentPts.join(" "),
          color:
            currentType === "brake"
              ? "hsl(var(--apex-red))"
              : currentType === "accel"
              ? "hsl(var(--apex-green))"
              : "hsl(var(--apex-yellow))",
        });
        // Keep last point to connect segments
        currentPts = [currentPts[currentPts.length - 1]];
      }
      currentType = type;
      const pt = yasMarinaCenterline[wrappedIdx];
      currentPts.push(`${pt[0]},${pt[1]}`);
    }
    if (currentPts.length > 1) {
      segs.push({
        points: currentPts.join(" "),
        color:
          currentType === "brake"
            ? "hsl(var(--apex-red))"
            : currentType === "accel"
            ? "hsl(var(--apex-green))"
            : "hsl(var(--apex-yellow))",
      });
    }
    return segs;
  }, [carIdx, lookahead]);

  const carPos = yasMarinaCenterline[carIdx % TRACK_TOTAL_POINTS];
  const refPos =
    refProgress !== undefined
      ? yasMarinaCenterline[
          Math.floor(refProgress * (TRACK_TOTAL_POINTS - 1)) %
            TRACK_TOTAL_POINTS
        ]
      : null;

  return (
    <svg
      viewBox="20 100 348 560"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Track surface */}
      <polyline
        points={leftPoly}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={compact ? 1 : 1.5}
        opacity={0.4}
      />
      <polyline
        points={rightPoly}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={compact ? 1 : 1.5}
        opacity={0.4}
      />

      {/* Centerline (racing line) */}
      <polyline
        points={centerPoly}
        fill="none"
        stroke="hsl(var(--apex-blue))"
        strokeWidth={compact ? 1.5 : 2}
        opacity={0.25}
        strokeLinejoin="round"
      />

      {/* Trajectory ahead of car - color coded */}
      {trajectorySegments.map((seg, i) => (
        <polyline
          key={i}
          points={seg.points}
          fill="none"
          stroke={seg.color}
          strokeWidth={compact ? 4 : 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
          style={{
            filter: `drop-shadow(0 0 ${compact ? 4 : 8}px ${seg.color})`,
          }}
        />
      ))}

      {/* Reference car */}
      {refPos && (
        <circle
          cx={refPos[0]}
          cy={refPos[1]}
          r={compact ? 6 : 8}
          fill="hsl(var(--apex-blue))"
          opacity={0.6}
          style={{
            filter: "drop-shadow(0 0 4px hsl(var(--apex-blue) / 0.6))",
          }}
        />
      )}

      {/* Current car position */}
      <circle
        cx={carPos[0]}
        cy={carPos[1]}
        r={compact ? 7 : 10}
        fill="hsl(var(--primary))"
        stroke="hsl(var(--foreground))"
        strokeWidth={2}
        style={{
          filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.8))",
        }}
      >
        <animate
          attributeName="r"
          values={compact ? "6;8;6" : "9;12;9"}
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
};

export default TrackMap;
