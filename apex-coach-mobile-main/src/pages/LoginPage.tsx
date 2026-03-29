import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Mail, Lock, ChevronRight } from "lucide-react";

type Tab = "signin" | "create";

const API = "/api";

async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

async function apiRegister(name: string, email: string, password: string) {
  const res = await fetch(`${API}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) { setError("Email and password are required"); return; }
    if (tab === "create") {
      if (!name) { setError("Name is required"); return; }
      if (password !== confirm) { setError("Passwords do not match"); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    }
    setLoading(true);
    try {
      const user = tab === "signin"
        ? await apiLogin(email, password)
        : await apiRegister(name, email, password);
      localStorage.setItem("apexcoach_user", JSON.stringify(user));
      navigate("/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    localStorage.setItem("apexcoach_user", JSON.stringify({ id: 0, name: "Guest", email: "" }));
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col gap-5"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <img src="/logo.png" alt="Apex Coach" className="w-16 h-16 object-contain" />
          <h1 className="font-display text-2xl font-bold tracking-widest text-foreground">APEX COACH</h1>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
          {(["signin", "create"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 py-2.5 rounded-md font-display text-xs tracking-wider uppercase transition-all ${
                tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="apex-card flex flex-col gap-3 p-5">
          {tab === "create" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Full Name</label>
              <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2.5">
                <User size={14} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Email</label>
            <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2.5">
              <Mail size={14} className="text-muted-foreground flex-shrink-0" />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@team.com"
                className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Password</label>
            <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2.5">
              <Lock size={14} className="text-muted-foreground flex-shrink-0" />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
              />
            </div>
          </div>

          {tab === "create" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">Confirm Password</label>
              <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2.5">
                <Lock size={14} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive font-body text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="apex-btn-primary w-full text-center uppercase tracking-widest py-3 mt-1 disabled:opacity-60"
          >
            {loading ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
          </button>
        </div>

        <button
          onClick={handleGuest}
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
        >
          Continue as Guest <ChevronRight size={14} />
        </button>
      </motion.div>
    </div>
  );
}
