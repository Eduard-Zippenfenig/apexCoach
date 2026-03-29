import { useState } from "react";
import { useNavigate } from "react-router-dom";
type Option = string;

const PillSelector = ({ label, options, value, onChange }: { label: string; options: Option[]; value: string; onChange: (v: string) => void }) => (
  <div className="flex flex-col gap-2">
    <label className="text-xs text-muted-foreground font-display uppercase tracking-widest">{label}</label>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-4 py-2.5 rounded-lg font-body text-sm font-semibold transition-all ${
            value === opt
              ? "bg-primary/20 text-primary border border-primary/40"
              : "bg-secondary text-muted-foreground border border-border hover:border-primary/20"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

const MODE_INFO: Record<string, { label: string; description: string; focus: string; color: string }> = {
  Learn:       { label: "Learn",       description: "Detailed coaching with patient audio cues. Warns early, explains every correction.", focus: "Line & braking technique",    color: "text-accent" },
  Push:        { label: "Push",        description: "Aggressive speed-focused coaching. Every tenth counts. Maximum time attack.",       focus: "Speed & throttle",             color: "text-destructive" },
  Consistency: { label: "Consistency", description: "Focus on smooth, repeatable lines. Minimise deviations lap after lap.",             focus: "Line accuracy & smoothness",  color: "text-primary" },
  Practice:    { label: "Practice",    description: "Balanced coaching. Good for exploring a new car or track layout.",                  focus: "Balanced all-round feedback",  color: "text-apex-yellow" },
};

const VehicleSetup = () => {
  const navigate = useNavigate();
  const [experience, setExperience] = useState("Intermediate");
  const [confidence, setConfidence] = useState("Medium");
  const [goal, setGoal] = useState("Faster");
  const [coachStyle, setCoachStyle] = useState("Calm");
  const [carBrand, setCarBrand] = useState("Porsche");
  const [drivetrain, setDrivetrain] = useState("RWD");
  const [horsepower, setHorsepower] = useState("301+");
  const [tyres, setTyres] = useState("Semi-slick");
  const [transmission, setTransmission] = useState("Manual");
  const [trackCondition, setTrackCondition] = useState("Dry");
  const [mode, setMode] = useState("Push");

  const handleContinue = () => {
    localStorage.setItem("apexcoach_setup", JSON.stringify({
      experience, confidence, goal, coachStyle,
      drivetrain, horsepower, tyres, transmission,
      trackCondition, mode, carBrand,
    }));
    navigate("/sensor-check");
  };

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain" />
          <div>
            <h2 className="text-3xl font-bold tracking-wider text-foreground">Setup Session</h2>
            <p className="text-muted-foreground font-body text-lg">Configure your driver profile and vehicle</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate("/track-selection")} className="apex-btn-secondary uppercase tracking-wider text-sm">Back</button>
          <button onClick={handleContinue} className="apex-btn-primary uppercase tracking-wider text-sm">Continue</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-auto">
        {/* Driver */}
        <div className="apex-card p-6 flex flex-col gap-5">
          <h3 className="text-lg font-display tracking-wider text-foreground border-b border-border pb-3">Driver</h3>
          <PillSelector label="Experience" options={["Beginner", "Intermediate", "Advanced"]} value={experience} onChange={setExperience} />
          <PillSelector label="Confidence" options={["Low", "Medium", "High"]} value={confidence} onChange={setConfidence} />
          <PillSelector label="Goal" options={["Safer", "Faster", "Smoother", "Consistent"]} value={goal} onChange={setGoal} />
          <PillSelector label="Coaching Style" options={["Calm", "Direct", "Competitive"]} value={coachStyle} onChange={setCoachStyle} />
        </div>

        {/* Vehicle */}
        <div className="apex-card p-6 flex flex-col gap-5">
          <h3 className="text-lg font-display tracking-wider text-foreground border-b border-border pb-3">Vehicle</h3>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground font-display uppercase tracking-widest">Car Brand</label>
            <select
              value={carBrand}
              onChange={(e) => setCarBrand(e.target.value)}
              className="w-full bg-secondary text-foreground font-body text-sm rounded-lg px-4 py-3 appearance-none border border-border hover:border-primary/20 focus:border-primary focus:outline-none"
              style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
            >
              <option value="Porsche">Porsche</option>
              <option value="Ferrari">Ferrari</option>
              <option value="McLaren">McLaren</option>
              <option value="BMW">BMW</option>
              <option value="Mercedes-AMG">Mercedes-AMG</option>
              <option value="Audi">Audi</option>
              <option value="Aston Martin">Aston Martin</option>
              <option value="Lamborghini">Lamborghini</option>
              <option value="Ford">Ford</option>
              <option value="Chevrolet">Chevrolet</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <PillSelector label="Horsepower" options={["0-100", "101-300", "301+"]} value={horsepower} onChange={setHorsepower} />
          <PillSelector label="Drivetrain" options={["FWD", "RWD", "AWD"]} value={drivetrain} onChange={setDrivetrain} />
          <PillSelector label="Tyres" options={["Road", "Semi-slick", "Slick"]} value={tyres} onChange={setTyres} />
          <PillSelector label="Transmission" options={["Auto", "Manual", "Paddle"]} value={transmission} onChange={setTransmission} />
        </div>

        {/* Session + Summary */}
        <div className="flex flex-col gap-6">
          <div className="apex-card p-6 flex flex-col gap-5">
            <h3 className="text-lg font-display tracking-wider text-foreground border-b border-border pb-3">Session</h3>
            <PillSelector label="Track Condition" options={["Dry", "Wet", "Unknown"]} value={trackCondition} onChange={setTrackCondition} />
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground font-display uppercase tracking-widest">Coaching Mode</label>
              <div className="flex flex-col gap-2">
                {Object.entries(MODE_INFO).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`text-left px-3 py-2.5 rounded-lg border transition-all ${
                      mode === key
                        ? "bg-primary/10 border-primary/40"
                        : "bg-secondary border-border hover:border-primary/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-display text-sm font-bold tracking-wide ${mode === key ? info.color : "text-foreground"}`}>{info.label}</span>
                      <span className={`text-[10px] font-mono uppercase tracking-wider ${mode === key ? info.color : "text-muted-foreground"}`}>{info.focus}</span>
                    </div>
                    <p className="text-[11px] font-body text-muted-foreground mt-0.5 leading-tight">{info.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="apex-card p-6 flex-1 border-primary/20">
            <h3 className="text-lg font-display tracking-wider text-primary border-b border-primary/20 pb-3 mb-4">Setup Summary</h3>
            <div className="grid grid-cols-2 gap-3 font-body text-sm">
              {[
                ["Track", "Yas Marina"],
                ["Car", carBrand],
                ["Power", `${horsepower} HP`],
                ["Drivetrain", drivetrain],
                ["Tyres", tyres],
                ["Experience", experience],
                ["Goal", goal],
                ["Coach", coachStyle],
                ["Mode", mode],
                ["Condition", trackCondition],
                ["Transmission", transmission],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleSetup;
