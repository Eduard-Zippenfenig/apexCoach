import { MobileLayout } from "@/components/MobileLayout";
import { StatCard } from "@/components/StatCard";
import { QrScanner } from "@/components/QrScanner";
import { driver, sessions } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import { QrCode, ChevronRight, CheckCircle2, Clock, MapPin, Car } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function HomePage() {
  const navigate = useNavigate();
  const [synced, setSynced] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedSession, setScannedSession] = useState<any>(null);
  const latest = sessions[0];

  const handleScanComplete = useCallback(async (scannedData?: string) => {
    setScannerOpen(false);
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
    if (scannedData && scannedData.startsWith("http")) {
      try {
        const res = await fetch(scannedData);
        if (res.ok) {
          const sessionData = await res.json();
          const userRaw = localStorage.getItem("apexcoach_user");
          const user = userRaw ? JSON.parse(userRaw) : null;
          if (user?.id && user.id > 0) {
            await fetch(`${API_BASE}/users/${user.id}/sessions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                track: sessionData.track,
                lap_time_s: sessionData.lap_time_s,
                ref_lap_time_s: sessionData.ref_lap_time_s,
                gap_s: sessionData.gap_s,
                scores: sessionData.scores,
                summary: sessionData.summary,
              }),
            });
          }
          localStorage.setItem("apexcoach_last_session", JSON.stringify(sessionData));
          setScannedSession(sessionData);
        }
      } catch {
        // Silently ignore fetch errors
      }
    }
    setSynced(true);
  }, []);

  return (
    <MobileLayout>
      <div className="flex flex-col gap-5 px-4 pt-6">
        {/* Greeting */}
        {/* Header with Logo */}
        <div className="flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <h1 className="font-display text-2xl font-bold">{driver.name}</h1>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
          </motion.div>
        </div>

        {/* Sync Status / Primary Action */}
        <QrScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScanned={handleScanComplete} />
        <AnimatePresence mode="wait">
          {!synced ? (
            <motion.button
              key="scan"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onClick={() => setScannerOpen(true)}
              className="apex-card-glow flex flex-col items-center gap-4 py-8 text-center"
            >
              <div className="rounded-2xl bg-primary/10 p-5">
                <QrCode size={40} className="text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">
                  Scan Tablet QR Code
                </h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-[260px]">
                  Connect with your in-car tablet to sync your latest track session
                </p>
              </div>
            </motion.button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => navigate("/sessions/last-synced")}
              className="apex-card border-l-4 border-l-primary flex items-start gap-3 py-5 cursor-pointer hover:bg-white/5 transition-all"
            >
              <CheckCircle2 size={24} className="text-primary flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-display text-base font-bold text-foreground">Session Synced</p>
                  <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded tracking-tighter animate-pulse">NEW</span>
                </div>
                <div className="flex flex-col gap-0.5 mt-1 text-muted-foreground">
                  <p className="text-sm font-medium text-foreground/90">
                    {scannedSession?.track || "Yas Marina Circuit"}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1"><Car size={10} /> {scannedSession?.car}</span>
                    <span>{scannedSession?.horsepower ? `${scannedSession.horsepower} HP` : ""}</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground self-center" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Latest Session Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="apex-card cursor-pointer shadow-sm"
          onClick={() => navigate(`/sessions/${latest.id}`)}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Latest Session</span>
            <span className="text-xs text-muted-foreground">{latest.date}</span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-bold">{latest.track}</h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Car size={12} /> {latest.car}</span>
                <span>{latest.tyres}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono text-2xl font-bold text-primary">{latest.bestLap}</span>
              <p className="text-[10px] text-muted-foreground">Best lap</p>
            </div>
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-secondary px-2 py-2 text-center">
              <span className="font-mono text-sm font-bold">{latest.totalLaps}</span>
              <p className="text-[10px] text-muted-foreground">Laps</p>
            </div>
            <div className="rounded-lg bg-secondary px-2 py-2 text-center">
              <span className="font-mono text-sm font-bold">{latest.consistency}%</span>
              <p className="text-[10px] text-muted-foreground">Consistency</p>
            </div>
            <div className="rounded-lg bg-secondary px-2 py-2 text-center">
              <span className="font-mono text-sm font-bold">{latest.brakingScore}</span>
              <p className="text-[10px] text-muted-foreground">Braking</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2.5">
            <span className="text-xs font-semibold text-primary">View Full Analysis</span>
            <ChevronRight size={14} className="text-primary" />
          </div>
        </motion.div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Sessions" value={driver.totalSessions} />
          <StatCard label="Total Laps" value={driver.totalLaps} />
        </div>

        {/* Recent sessions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Recent Sessions</span>
            <button onClick={() => navigate("/sessions")} className="text-xs text-primary font-medium">See all</button>
          </div>
          <div className="flex flex-col gap-2">
            {sessions.slice(1, 4).map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/sessions/${s.id}`)}
                className="apex-card flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-secondary p-2">
                    <MapPin size={14} className="text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{s.track}</p>
                    <p className="text-xs text-muted-foreground">{s.date} · {s.car}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold">{s.bestLap}</span>
                  <p className="text-[10px] text-muted-foreground">{s.totalLaps} laps</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-2" />
      </div>
    </MobileLayout>
  );
}
