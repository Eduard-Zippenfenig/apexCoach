import { MobileLayout } from "@/components/MobileLayout";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { User, Car, Settings, Bell, Moon, Gauge, ChevronRight, LogOut, Shield, Globe, Volume2 } from "lucide-react";
import { motion } from "framer-motion";

interface StoredUser {
  id: number;
  username: string;
  email?: string;
  created_at?: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [sessionCount, setSessionCount] = useState<number>(0);

  useEffect(() => {
    const raw = localStorage.getItem("apexcoach_user");
    if (!raw) {
      navigate("/login");
      return;
    }
    const u: StoredUser = JSON.parse(raw);
    setUser(u);

    // Fetch real session count from backend
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
    fetch(`${API_BASE}/users/${u.id}/sessions`)
      .then(r => r.ok ? r.json() : [])
      .then((sessions: unknown[]) => setSessionCount(sessions.length))
      .catch(() => setSessionCount(0));
  }, [navigate]);

  const handleSignOut = () => {
    localStorage.removeItem("apexcoach_user");
    navigate("/login");
  };

  const menuSections = [
    {
      title: "Racing",
      items: [
        { icon: <Car size={18} />, label: "Garage & Cars", path: "/profile/garage" },
        { icon: <Gauge size={18} />, label: "Coach Recommendations", path: "/profile/coach" },
      ],
    },
    {
      title: "Preferences",
      items: [
        { icon: <Bell size={18} />, label: "Notifications", path: "#" },
        { icon: <Globe size={18} />, label: "Units (km/h)", path: "#" },
        { icon: <Volume2 size={18} />, label: "Audio Coach", path: "#" },
        { icon: <Moon size={18} />, label: "Theme", path: "#" },
      ],
    },
    {
      title: "Account",
      items: [
        { icon: <Shield size={18} />, label: "Privacy", path: "#" },
        { icon: <Settings size={18} />, label: "Settings", path: "#" },
        { icon: <LogOut size={18} />, label: "Sign Out", action: handleSignOut },
      ],
    },
  ];

  if (!user) return null;

  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <MobileLayout>
      <div className="flex flex-col gap-4 px-4 pt-6">
        {/* Profile header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="apex-card flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <User size={28} className="text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold">{user.username}</h1>
            {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
            <p className="text-xs text-muted-foreground mt-0.5">Member since {joinDate}</p>
          </div>
        </motion.div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="apex-card text-center">
            <span className="font-mono text-lg font-bold">{sessionCount}</span>
            <p className="text-[10px] text-muted-foreground">Sessions</p>
          </div>
          <div className="apex-card text-center">
            <span className="font-mono text-lg font-bold">#{user.id}</span>
            <p className="text-[10px] text-muted-foreground">Driver ID</p>
          </div>
        </div>

        {/* Sync state */}
        <div className="apex-card flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Tablet Sync</span>
            <p className="text-xs text-muted-foreground">{sessionCount} session{sessionCount !== 1 ? "s" : ""} synced</p>
          </div>
          <span className="rounded-full bg-apex-green/15 px-2 py-0.5 text-xs font-medium text-apex-green">Connected</span>
        </div>

        {/* Menu sections */}
        {menuSections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <span className="stat-label px-1 mb-1">{section.title}</span>
            <div className="apex-card flex flex-col divide-y divide-border p-0 overflow-hidden">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if ("action" in item && item.action) {
                      item.action();
                    } else if ("path" in item && item.path !== "#") {
                      navigate(item.path as string);
                    }
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <span className={"action" in item && item.action ? "text-destructive" : "text-muted-foreground"}>{item.icon}</span>
                  <span className={"flex-1 text-left text-sm " + ("action" in item && item.action ? "text-destructive" : "")}>{item.label}</span>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="h-2" />
      </div>
    </MobileLayout>
  );
}
