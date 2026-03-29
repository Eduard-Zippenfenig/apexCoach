import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const SyncExport = () => {
  const navigate = useNavigate();
  const [qrUrl, setQrUrl] = useState("");
  const [sessionExportUrl, setSessionExportUrl] = useState("");

  useEffect(() => {
    // Use the actual host IP so mobile can reach the backend on the same network
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
    const MOBILE_APP_URL = import.meta.env.VITE_MOBILE_URL || "http://localhost:8081";
    
    // Build the base export URL
    let exportUrl = `${API_BASE}/api/session/export`;
    
    // Build query parameters
    const params = new URLSearchParams();
    
    const userRaw = localStorage.getItem("apexcoach_user");
    if (userRaw && userRaw !== "undefined") {
      try {
        const user = JSON.parse(userRaw);
        if (user && user.id) {
          params.append("user_id", user.id.toString());
        }
      } catch (e) {}
    }

    const setupRaw = localStorage.getItem("apexcoach_setup");
    if (setupRaw) {
      try {
        const setup = JSON.parse(setupRaw);
        if (setup.carBrand) params.append("carBrand", setup.carBrand);
        if (setup.horsepower) params.append("horsepower", setup.horsepower);
      } catch (e) {}
    }

    const queryString = params.toString();
    if (queryString) {
      exportUrl += `?${queryString}`;
    }

    setSessionExportUrl(exportUrl);

    // The QR code should link to the MOBILE APP, passing the exportUrl as a parameter
    const syncUrl = `${MOBILE_APP_URL}/?import=${encodeURIComponent(exportUrl)}`;
    
    setQrUrl(
      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=00ff88&bgcolor=0a0a0a&data=${encodeURIComponent(syncUrl)}`
    );
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-xl w-full flex flex-col items-center gap-8">
        <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center apex-glow-green animate-pulse-glow">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-display font-bold tracking-wider text-foreground">Session Synced</h2>
          <p className="text-muted-foreground font-body text-lg mt-2">Your session data has been saved and synced</p>
        </div>

        <div className="w-full flex flex-col gap-3">
          {[
            { label: "Saved to Account", status: "Complete" },
            { label: "Available on Phone App", status: "Synced" },
            { label: "Cloud Dashboard", status: "Uploaded" },
          ].map((item) => (
            <div key={item.label} className="apex-card p-5 flex items-center gap-4">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4"/></svg>
              <div className="flex-1">
                <p className="text-foreground font-body text-lg font-semibold">{item.label}</p>
              </div>
              <span className="text-sm font-mono text-primary uppercase tracking-wider">{item.status}</span>
            </div>
          ))}
        </div>

        <div className="apex-card p-6 flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground font-display uppercase tracking-widest">Scan to Import Session on Phone</p>
          {qrUrl ? (
            <div className="rounded-lg overflow-hidden border-2 border-primary/40" style={{ background: "#0a0a0a" }}>
              <img src={qrUrl} alt="QR code for session export" width={220} height={220} />
            </div>
          ) : (
            <div className="w-[220px] h-[220px] flex items-center justify-center border-2 border-primary/40 rounded-lg">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <p className="text-xs text-muted-foreground font-body text-center">
            Scan with Apex Coach mobile app to import this session
          </p>
          <p className="text-[10px] font-mono text-muted-foreground/50 break-all max-w-[220px] text-center">
            {sessionExportUrl}
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate("/")} className="apex-btn-primary uppercase tracking-widest">
            New Session
          </button>
          <button onClick={() => navigate("/summary")} className="apex-btn-secondary uppercase tracking-wider">
            Back to Summary
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncExport;
