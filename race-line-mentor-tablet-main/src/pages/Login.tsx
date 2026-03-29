import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { recentDrivers } from "@/data/mockData";

const API = import.meta.env.VITE_API_BASE_URL || "";

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

type Tab = "signin" | "create";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const proceed = () => navigate("/track-selection");

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) { setError("Email and password are required"); return; }
    setLoading(true);
    try {
      const user = tab === "signin"
        ? await apiLogin(email, password)
        : await apiRegister(name, email, password);
      localStorage.setItem("apexcoach_user", JSON.stringify(user));
      proceed();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Left: Auth */}
        <div className="apex-card p-8 flex flex-col gap-5">
          <div className="flex justify-center mb-2">
            <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
          </div>
          {/* Tab switcher */}
          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
            {(["signin", "create"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-md font-display text-xs tracking-wider uppercase transition-all ${
                  tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Google */}
          <button
            onClick={proceed}
            className="flex items-center justify-center gap-3 w-full py-3.5 rounded-lg border border-border bg-secondary hover:bg-card transition-all font-body font-semibold text-foreground"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-body uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <div className="flex flex-col gap-3">
            {tab === "create" && (
              <div>
                <label className="text-xs text-muted-foreground font-display uppercase tracking-widest block mb-1.5">Full Name</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground font-body focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground font-display uppercase tracking-widest block mb-1.5">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@team.com"
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground font-body focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-display uppercase tracking-widest block mb-1.5">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground font-body focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {tab === "create" && (
              <div>
                <label className="text-xs text-muted-foreground font-display uppercase tracking-widest block mb-1.5">Confirm Password</label>
                <input
                  type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground font-body focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive font-body text-center">{error}</p>
          )}

          <div className="flex flex-col gap-2 mt-1">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="apex-btn-primary w-full text-center uppercase tracking-widest py-4 disabled:opacity-60"
            >
              {loading ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
            </button>
            <button onClick={proceed} className="apex-btn-secondary w-full text-center uppercase tracking-wider text-sm">
              Continue as Guest
            </button>
          </div>

          {tab === "signin" && (
            <button className="text-xs text-muted-foreground hover:text-primary transition-colors font-body text-center">
              Forgot password?
            </button>
          )}

          <button onClick={() => navigate("/")} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body mt-auto">
            ← Back
          </button>
        </div>

        {/* Right: Recent drivers */}
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-wider text-foreground">Recent Drivers</h3>
            <p className="text-sm text-muted-foreground font-body mt-1">Tap to load your profile instantly</p>
          </div>

          <div className="flex flex-col gap-3">
            {recentDrivers.map((driver) => (
              <button
                key={driver.name}
                onClick={proceed}
                className="apex-card p-5 flex items-center gap-4 hover:border-primary/40 transition-all group text-left"
              >
                <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-display text-lg font-bold group-hover:bg-primary/30 transition-colors">
                  {driver.avatar}
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-body text-xl font-semibold">{driver.name}</p>
                  <p className="text-muted-foreground font-body text-sm">{driver.lastSession}</p>
                </div>
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            ))}
          </div>

          <div className="apex-card p-5 border-border/50 bg-secondary/30">
            <p className="text-xs font-display text-muted-foreground uppercase tracking-widest mb-2">Helmet QR Login</p>
            <p className="text-sm font-body text-muted-foreground">Scan the QR code on your helmet to instantly load your driver profile and session preferences.</p>
          </div>

          <button
            onClick={() => navigate("/operator")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider mt-auto"
          >
            Operator Handoff →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
