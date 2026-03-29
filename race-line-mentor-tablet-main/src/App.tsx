import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import TrackSelection from "./pages/TrackSelection";
import VehicleSetup from "./pages/VehicleSetup";
import SensorCheck from "./pages/SensorCheck";
import LiveCoaching from "./pages/LiveCoaching";
import SessionSummary from "./pages/SessionSummary";
import PostAnalysis from "./pages/PostAnalysis";
import LapReplay from "./pages/LapReplay";
import SyncExport from "./pages/SyncExport";
import OperatorMode from "./pages/OperatorMode";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/login" element={<Login />} />
          <Route path="/track-selection" element={<TrackSelection />} />
          <Route path="/setup" element={<VehicleSetup />} />
          <Route path="/sensor-check" element={<SensorCheck />} />
          <Route path="/live" element={<LiveCoaching />} />
          <Route path="/summary" element={<SessionSummary />} />
          <Route path="/analysis" element={<PostAnalysis />} />
          <Route path="/replay" element={<LapReplay />} />
          <Route path="/sync" element={<SyncExport />} />
          <Route path="/operator" element={<OperatorMode />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
