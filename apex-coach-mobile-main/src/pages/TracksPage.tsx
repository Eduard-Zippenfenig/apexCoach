import { MobileLayout } from "@/components/MobileLayout";
import { ProgressRing } from "@/components/ProgressRing";
import { tracks } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { MapPin, ChevronRight, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function TracksPage() {
  const navigate = useNavigate();

  return (
    <MobileLayout>
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="font-display text-2xl font-bold">Tracks</h1>
        <p className="text-sm text-muted-foreground -mt-2">Your circuit progression</p>

        <div className="flex flex-col gap-3">
          {tracks.map((track, i) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => track.sessions > 0 ? navigate(`/tracks/${track.id}`) : undefined}
              className={`apex-card cursor-pointer active:scale-[0.98] transition-transform ${track.featured ? "border-primary/30" : ""} ${track.sessions === 0 ? "opacity-50 cursor-default" : ""}`}
            >
              <div className="flex items-center gap-4">
                <ProgressRing
                  value={track.mastery}
                  size={64}
                  strokeWidth={5}
                  color={track.mastery >= 60 ? "stroke-primary" : track.mastery >= 30 ? "stroke-apex-yellow" : "stroke-muted-foreground"}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-bold">{track.name}</h3>
                    {track.featured && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">Featured</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={10} />
                    <span>{track.country}</span>
                    <span>·</span>
                    <span>{track.length}</span>
                    <span>·</span>
                    <span>{track.turns} turns</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    {track.sessions > 0 ? (
                      <>
                        <span><span className="font-mono font-bold">{track.sessions}</span> sessions</span>
                        <span><span className="font-mono font-bold">{track.totalLaps}</span> laps</span>
                        <span className="font-mono font-bold text-primary">{track.personalBest}</span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground"><Lock size={10} /> Not visited yet</span>
                    )}
                  </div>
                </div>
                {track.sessions > 0 && <ChevronRight size={16} className="text-muted-foreground" />}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </MobileLayout>
  );
}
