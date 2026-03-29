import { useNavigate } from "react-router-dom";

const Splash = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 400 400">
        <path
          d="M 150 50 C 180 50 200 60 220 80 C 240 100 250 130 240 160 C 230 190 200 210 180 230 C 160 250 150 270 160 290 C 170 310 190 320 210 310 C 230 300 240 280 250 260 C 260 240 280 230 300 240 C 320 250 330 270 320 290 C 310 310 290 330 260 340 C 230 350 200 340 180 320 C 160 300 140 270 130 240 C 120 210 100 190 80 180 C 60 170 50 150 60 130 C 70 110 90 100 110 90 C 130 80 140 60 150 50 Z"
          fill="none"
          stroke="hsl(var(--apex-green))"
          strokeWidth="2"
          strokeDasharray="8 6"
        />
      </svg>

      <div className="absolute w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-slide-up">
        <div className="flex items-center justify-center p-2 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
          <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain animate-pulse-slow" />
        </div>

        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-[0.3em] text-foreground drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            APEX COACH
          </h1>
          <p className="text-lg text-muted-foreground mt-1 font-body tracking-widest uppercase">
            Tablet Edition
          </p>
        </div>

        <p className="text-xl text-muted-foreground font-body tracking-wide">
          Your track-day race engineer
        </p>

        <div className="flex flex-col items-center gap-4 mt-8">
          <button
            onClick={() => navigate("/login")}
            className="apex-btn-primary min-w-[280px] text-center uppercase tracking-widest"
          >
            Start Session
          </button>
          <button
            onClick={() => navigate("/operator")}
            className="text-muted-foreground text-sm hover:text-foreground transition-colors font-body tracking-wider uppercase"
          >
            Operator Mode
          </button>
        </div>
      </div>

      <div className="absolute bottom-6 flex items-center gap-6 text-xs text-muted-foreground font-mono tracking-wider">
        <span>v2.1.0</span>
        <span className="w-1 h-1 rounded-full bg-primary animate-pulse-glow" />
        <span>TABLET READY</span>
      </div>
    </div>
  );
};

export default Splash;
