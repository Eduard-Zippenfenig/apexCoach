import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Gauge, BarChart3, Trophy } from "lucide-react";

const slides = [
  {
    icon: <Gauge size={48} className="text-primary glow-green" />,
    title: "Track-Day Coaching",
    subtitle: "Live on tablet",
    desc: "Real-time coaching during your session with AI-powered guidance on every corner.",
  },
  {
    icon: <BarChart3 size={48} className="text-apex-blue glow-blue" />,
    title: "Full Analysis",
    subtitle: "On your phone",
    desc: "Deep post-session analysis with sector breakdowns, corner insights, and telemetry review.",
  },
  {
    icon: <Trophy size={48} className="text-apex-purple glow-purple" />,
    title: "Improve Lap After Lap",
    subtitle: "Track your journey",
    desc: "Skills, achievements, and personalized recommendations to make you faster every session.",
  },
];

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-between px-6 py-12">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <img src="/logo.png" alt="Apex Coach" className="w-16 h-16 object-contain mb-2" />
        <h1 className="font-display text-2xl font-bold tracking-wider">APEX COACH</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your personal race engineer</p>
      </div>

      {/* Slides */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center gap-4"
          >
            <div className="rounded-2xl bg-secondary/50 p-6">{slides[current].icon}</div>
            <div>
              <h2 className="font-display text-xl font-bold">{slides[current].title}</h2>
              <p className="text-sm text-primary font-medium">{slides[current].subtitle}</p>
            </div>
            <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">{slides[current].desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="flex gap-2 mb-6">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-2 bg-secondary"}`}
          />
        ))}
      </div>

      {/* Buttons */}
      <div className="w-full flex flex-col gap-3">
        {current < slides.length - 1 ? (
          <button
            onClick={() => setCurrent(current + 1)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-display text-sm font-bold tracking-wider text-primary-foreground"
          >
            NEXT <ChevronRight size={16} />
          </button>
        ) : (
          <>
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-xl bg-primary px-6 py-3.5 font-display text-sm font-bold tracking-wider text-primary-foreground"
            >
              CREATE ACCOUNT
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-xl border border-border px-6 py-3.5 font-display text-sm font-bold tracking-wider text-foreground"
            >
              SIGN IN
            </button>
          </>
        )}
        <button
          onClick={() => navigate("/")}
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          Continue with demo data
        </button>
      </div>
    </div>
  );
}
