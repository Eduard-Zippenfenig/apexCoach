import { MobileLayout } from "@/components/MobileLayout";
import { cars } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Fuel, Gauge, Trophy, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function GaragePage() {
  const navigate = useNavigate();

  return (
    <MobileLayout>
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-secondary">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display text-xl font-bold">Garage</h1>
        </div>

        <p className="text-sm text-muted-foreground -mt-2">Cars and setups you've driven</p>

        <div className="flex flex-col gap-3">
          {cars.map((car, i) => (
            <motion.div
              key={car.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="apex-card"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-secondary p-2.5">
                    <Car size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold">{car.name}</h3>
                    <p className="text-xs text-muted-foreground">{car.drivetrain} · {car.power}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg bg-secondary/50 px-2 py-1.5 text-center">
                  <span className="font-mono text-sm font-bold">{car.sessions}</span>
                  <p className="text-[10px] text-muted-foreground">Sessions</p>
                </div>
                <div className="rounded-lg bg-secondary/50 px-2 py-1.5 text-center">
                  <span className="font-mono text-sm font-bold text-primary">{car.bestLap}</span>
                  <p className="text-[10px] text-muted-foreground">Best Lap</p>
                </div>
                <div className="rounded-lg bg-secondary/50 px-2 py-1.5 text-center">
                  <span className="font-mono text-sm font-bold">{car.avgConsistency}%</span>
                  <p className="text-[10px] text-muted-foreground">Consistency</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Trophy size={10} className="text-apex-yellow" />
                <span>Best at {car.bestTrack}</span>
                <span>·</span>
                <span>Tyres: {car.tyresUsed.join(", ")}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="h-2" />
      </div>
    </MobileLayout>
  );
}
