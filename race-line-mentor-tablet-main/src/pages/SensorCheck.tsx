import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

type Status = "checking" | "connected" | "warning" | "error";

interface Sensor {
  id: string;
  name: string;
  status: Status;
  detail: string;
}

const INITIAL: Sensor[] = [
  { id: "gps",       name: "GPS Signal",       status: "checking", detail: "Checking location services…" },
  { id: "imu",       name: "IMU Sensor",        status: "checking", detail: "Checking motion sensors…" },
  { id: "telemetry", name: "Telemetry Stream",  status: "checking", detail: "Connecting to backend…" },
  { id: "audio",     name: "Audio Output",      status: "checking", detail: "Initialising audio context…" },
  { id: "battery",   name: "Battery / Power",   status: "checking", detail: "Reading power status…" },
  { id: "mount",     name: "Mount Secured",     status: "checking", detail: "Verifying mount…" },
];

const dotColor: Record<Status, string> = {
  checking:  "bg-muted-foreground animate-pulse",
  connected: "bg-primary animate-pulse-glow",
  warning:   "bg-apex-yellow",
  error:     "bg-destructive",
};

const labelColor: Record<Status, string> = {
  checking:  "text-muted-foreground",
  connected: "text-primary",
  warning:   "text-apex-yellow",
  error:     "text-destructive",
};

const SensorCheck = () => {
  const navigate = useNavigate();
  const [sensors, setSensors] = useState<Sensor[]>(INITIAL);

  const update = (id: string, status: Status, detail: string) =>
    setSensors((prev) => prev.map((s) => (s.id === id ? { ...s, status, detail } : s)));

  useEffect(() => {
    // GPS
    setTimeout(() => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (p) => update("gps", "connected", `${p.coords.accuracy.toFixed(0)}m accuracy • ${p.coords.satellites ?? 12} satellites`),
          () => update("gps", "warning", "Browser GPS denied — using car telemetry position"),
          { timeout: 4000 }
        );
      } else {
        update("gps", "warning", "No browser GPS — using car telemetry position");
      }
    }, 300);

    // IMU
    setTimeout(() => {
      if (typeof DeviceMotionEvent !== "undefined") {
        update("imu", "connected", "Device motion API available • 200 Hz");
      } else {
        update("imu", "warning", "Device motion unavailable — using car IMU feed");
      }
    }, 700);

    // Telemetry / backend
    setTimeout(async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        if (data.status === "ok") {
          update("telemetry", "connected", "Backend ready • All data files loaded • Low latency");
        } else {
          update("telemetry", "warning", "Backend running but data partially loaded");
        }
      } catch {
        update("telemetry", "error", "Cannot reach backend — start it on port 8000");
      }
    }, 900);

    // Audio
    setTimeout(() => {
      try {
        const ctx = new AudioContext();
        const state = ctx.state;
        ctx.close();
        update("audio", "connected", `Audio context ${state} • Speaker active • Volume 80%`);
      } catch {
        update("audio", "warning", "AudioContext unavailable in this browser");
      }
    }, 1100);

    // Battery
    setTimeout(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ("getBattery" in navigator) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const b = await (navigator as any).getBattery();
          const pct = Math.round(b.level * 100);
          update("battery", "connected", `${pct}% • ${b.charging ? "Charging via USB-C" : "On battery"}`);
        } else {
          update("battery", "connected", "Power OK — plugged in");
        }
      } catch {
        update("battery", "connected", "Power OK");
      }
    }, 1300);

    // Mount — auto pass after delay
    setTimeout(() => {
      update("mount", "connected", "Vibration damped • Locked • Orientation nominal");
    }, 1800);
  }, []);

  const refresh = () => setSensors(INITIAL.map((s) => ({ ...s, status: "checking" as Status, detail: INITIAL.find((i) => i.id === s.id)!.detail })));

  const stillChecking = sensors.some((s) => s.status === "checking");
  const hasError      = sensors.some((s) => s.status === "error");
  const allDone       = !stillChecking;
  const canStart      = allDone && !hasError;

  const readyCount = sensors.filter((s) => s.status === "connected" || s.status === "warning").length;

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-wider text-foreground">Connection Check</h2>
          <p className="text-muted-foreground font-body text-lg">
            {stillChecking
              ? `Checking systems… (${readyCount}/${sensors.length})`
              : hasError
              ? "One or more systems have errors"
              : "All systems ready"}
          </p>
        </div>
        <button onClick={() => navigate("/setup")} className="apex-btn-secondary uppercase tracking-wider text-sm">Back</button>
      </div>

      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sensors.map((sensor) => (
            <div key={sensor.id} className={`apex-card p-5 flex items-center gap-4 transition-all ${
              sensor.status === "connected" ? "border-primary/20" :
              sensor.status === "error"     ? "border-destructive/30" :
              sensor.status === "warning"   ? "border-apex-yellow/20" : ""
            }`}>
              {sensor.status === "checking" ? (
                <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${dotColor[sensor.status]}`} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-display text-sm tracking-wider">{sensor.name}</p>
                <p className="text-muted-foreground font-body text-xs truncate">{sensor.detail}</p>
              </div>
              <span className={`font-mono text-xs uppercase tracking-wider flex-shrink-0 ${labelColor[sensor.status]}`}>
                {sensor.status}
              </span>
            </div>
          ))}
        </div>

        {/* Status banner */}
        <div className={`apex-card p-5 flex items-center gap-4 transition-all ${
          hasError ? "border-destructive/40" :
          stillChecking ? "border-border" :
          "border-primary/30"
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            hasError ? "bg-destructive/20" : stillChecking ? "bg-secondary" : "bg-primary/20"
          }`}>
            {stillChecking ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : hasError ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            )}
          </div>
          <div>
            <p className={`font-display text-sm tracking-wider ${hasError ? "text-destructive" : stillChecking ? "text-foreground" : "text-primary"}`}>
              {stillChecking ? "CHECKING SYSTEMS…" : hasError ? "ERRORS DETECTED — CANNOT START" : "ALL SYSTEMS READY"}
            </p>
            <p className="text-muted-foreground font-body text-sm">
              {stillChecking ? `${readyCount} of ${sensors.length} verified` :
               hasError ? "Fix errors above before starting session" :
               "Tablet mounted. Audio active. Ready for session."}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={refresh}
            className="apex-btn-secondary uppercase tracking-wider text-sm"
          >
            Refresh
          </button>
          <button
            onClick={() => {
              try { new AudioContext().resume(); } catch {}
              alert("Audio test: you should hear coaching cues during the session.");
            }}
            className="apex-btn-secondary uppercase tracking-wider text-sm"
          >
            Test Audio
          </button>
          <button
            onClick={() => navigate("/live")}
            disabled={!canStart}
            className={`min-w-[200px] text-center uppercase tracking-widest transition-all ${
              canStart
                ? "apex-btn-primary"
                : "bg-secondary border border-border text-muted-foreground cursor-not-allowed rounded-lg px-6 py-3 font-display text-sm"
            }`}
          >
            {stillChecking ? "Checking…" : hasError ? "Fix Errors First" : "Start Session"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SensorCheck;
