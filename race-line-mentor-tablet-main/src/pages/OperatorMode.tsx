import { useNavigate } from "react-router-dom";

const OperatorMode = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-wider text-foreground">Operator Mode</h2>
          <p className="text-muted-foreground font-body text-lg">Tablet management and driver assignment</p>
        </div>
        <button onClick={() => navigate("/")} className="apex-btn-secondary uppercase tracking-wider text-sm">Exit</button>
      </div>

      <div className="max-w-3xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <button className="apex-card p-8 flex flex-col items-center gap-4 hover:border-primary/30 transition-all">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div className="text-center">
            <p className="font-display text-sm tracking-wider text-foreground">Assign Driver</p>
            <p className="text-xs text-muted-foreground font-body mt-1">Hand tablet to new driver</p>
          </div>
        </button>

        <button className="apex-card p-8 flex flex-col items-center gap-4 hover:border-primary/30 transition-all">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          </div>
          <div className="text-center">
            <p className="font-display text-sm tracking-wider text-foreground">Reset Tablet</p>
            <p className="text-xs text-muted-foreground font-body mt-1">Clear session and reset to welcome</p>
          </div>
        </button>

        <button className="apex-card p-8 flex flex-col items-center gap-4 hover:border-primary/30 transition-all">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div className="text-center">
            <p className="font-display text-sm tracking-wider text-foreground">Check Connection</p>
            <p className="text-xs text-muted-foreground font-body mt-1">Verify GPS, IMU, and network</p>
          </div>
        </button>

        <button className="apex-card p-8 flex flex-col items-center gap-4 hover:border-primary/30 transition-all">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>
          </div>
          <div className="text-center">
            <p className="font-display text-sm tracking-wider text-foreground">Sync Status</p>
            <p className="text-xs text-muted-foreground font-body mt-1">Last sync: 3 min ago - All clear</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default OperatorMode;
