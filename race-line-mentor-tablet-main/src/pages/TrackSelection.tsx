import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { tracks } from "@/data/mockData";
import { yasMarinaCenterline, yasLeftBorder, yasRightBorder } from "@/data/trackGeometry";

const otherPaths: Record<string, string> = {
  "monza": "M 150,550 A 20,20 0 0,1 120,500 L 140,200 L 150,120 C 180,80 220,100 200,150 L 180,350 L 210,500 A 30,30 0 0,1 150,550 Z",
  "spa": "M 150,150 L 250,200 C 280,220 300,300 260,350 L 200,550 C 150,580 80,550 80,450 L 60,300 C 50,200 80,150 150,150 Z",
  "silverstone": "M 100,250 L 150,150 L 280,180 L 300,350 C 280,450 200,450 180,400 C 150,400 180,350 150,350 L 80,300 C 60,280 80,260 100,250 Z"
};

const TrackSelection = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("yas-marina");

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain" />
          <div>
            <h2 className="text-3xl font-bold tracking-wider text-foreground">Select Circuit</h2>
            <p className="text-muted-foreground font-body text-lg">Choose your track for this session</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate("/login")} className="apex-btn-secondary uppercase tracking-wider text-sm">Back</button>
          <button onClick={() => navigate("/setup")} className="apex-btn-primary uppercase tracking-wider text-sm">Next</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
        {tracks.map((track) => (
          <button
            key={track.id}
            onClick={() => track.available && setSelected(track.id)}
            disabled={!track.available}
            className={`apex-card p-6 flex flex-col items-center gap-4 transition-all relative ${
              selected === track.id ? "border-primary/60 apex-glow-green" : ""
            } ${!track.available ? "opacity-40 cursor-not-allowed" : "hover:border-primary/30"}`}
          >
            {track.featured && (
              <span className="absolute top-3 right-3 text-[10px] font-display uppercase tracking-widest bg-primary/20 text-primary px-2 py-1 rounded">
                Featured
              </span>
            )}

            {/* Track minimap */}
            <div className="w-full aspect-square flex items-center justify-center">
              <svg viewBox="20 100 348 560" className="w-full h-full max-w-[160px]">
                {track.id === "yas-marina" ? (
                  <>
                    <polyline
                      points={yasLeftBorder.map(p => `${p[0]},${p[1]}`).join(" ")}
                      fill="none"
                      stroke={selected === track.id ? "hsl(var(--apex-green))" : "hsl(var(--muted-foreground))"}
                      strokeWidth="2"
                      opacity={track.available ? 0.4 : 0.15}
                    />
                    <polyline
                      points={yasRightBorder.map(p => `${p[0]},${p[1]}`).join(" ")}
                      fill="none"
                      stroke={selected === track.id ? "hsl(var(--apex-green))" : "hsl(var(--muted-foreground))"}
                      strokeWidth="2"
                      opacity={track.available ? 0.4 : 0.15}
                    />
                    <polyline
                      points={yasMarinaCenterline.map(p => `${p[0]},${p[1]}`).join(" ")}
                      fill="none"
                      stroke={selected === track.id ? "hsl(var(--apex-green))" : "hsl(var(--muted-foreground))"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      opacity={track.available ? 1 : 0.3}
                    />
                  </>
                ) : (
                  <path 
                    d={otherPaths[track.id] || otherPaths["monza"]}
                    fill="none"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.15}
                  />
                )}
              </svg>
            </div>

            <div className="text-center">
              <p className="text-foreground font-display text-sm font-bold tracking-wider">{track.name}</p>
              <p className="text-muted-foreground font-body text-sm">{track.city}, {track.country}</p>
            </div>

            <div className="flex gap-2 flex-wrap justify-center">
              <span className="text-[11px] font-mono bg-secondary px-2 py-1 rounded text-muted-foreground">{track.length}</span>
              <span className="text-[11px] font-mono bg-secondary px-2 py-1 rounded text-muted-foreground">{track.turns}T</span>
              <span className={`text-[11px] font-mono px-2 py-1 rounded ${
                track.difficulty === "Expert" ? "bg-destructive/20 text-destructive" :
                track.difficulty === "Advanced" ? "bg-apex-yellow/20 text-apex-yellow" :
                "bg-primary/20 text-primary"
              }`}>{track.difficulty}</span>
            </div>

            {!track.available && (
              <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">Coming Soon</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TrackSelection;
