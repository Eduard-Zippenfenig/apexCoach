import { MobileLayout } from "@/components/MobileLayout";
import { sessions } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Search, Filter, Star, ChevronRight, Timer, Layers } from "lucide-react";
import { motion } from "framer-motion";

const tabOptions = ["All", "Best", "Recent", "Favorites"];

export default function SessionsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = sessions.filter((s) => {
    if (tab === "Favorites" && !s.favorite) return false;
    if (tab === "Best") return true; // show all sorted by best
    if (search && !s.track.toLowerCase().includes(search.toLowerCase()) && !s.car.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (tab === "Best") return parseFloat(a.bestLap.replace(":", "")) - parseFloat(b.bestLap.replace(":", ""));
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <MobileLayout>
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="font-display text-2xl font-bold">Sessions</h1>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5">
          <Search size={16} className="text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by track or car..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Filter size={16} className="text-muted-foreground" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-secondary p-1">
          {tabOptions.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Session list */}
        <div className="flex flex-col gap-3">
          {filtered.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/sessions/${s.id}`)}
              className="apex-card cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-bold">{s.track}</h3>
                    {s.favorite && <Star size={12} className="text-apex-yellow fill-apex-yellow" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.date} · {s.time}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground mt-1" />
              </div>
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-1.5">
                  <Timer size={12} className="text-primary" />
                  <span className="font-mono text-sm font-bold">{s.bestLap}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers size={12} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{s.totalLaps} laps</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  s.mode === "Push" ? "bg-apex-red/15 text-apex-red" : "bg-apex-blue/15 text-apex-blue"
                }`}>
                  {s.mode}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{s.car}</span>
                <span>·</span>
                <span>{s.tyres}</span>
                <span className="ml-auto font-mono text-xs">
                  <span className="text-muted-foreground">Consistency </span>
                  <span className="font-bold text-foreground">{s.consistency}%</span>
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </MobileLayout>
  );
}
