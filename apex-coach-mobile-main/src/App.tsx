import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePage from "./pages/HomePage";
import Onboarding from "./pages/Onboarding";
import LoginPage from "./pages/LoginPage";
import SessionsPage from "./pages/SessionsPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import PostAnalysisPage from "./pages/PostAnalysisPage";
import TracksPage from "./pages/TracksPage";
import TrackDetailPage from "./pages/TrackDetailPage";
import ProgressPage from "./pages/ProgressPage";
import ProfilePage from "./pages/ProfilePage";
import GaragePage from "./pages/GaragePage";
import CoachPage from "./pages/CoachPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const isLoggedIn = () => !!localStorage.getItem("apexcoach_user");

const PrivateRoute = ({ element }: { element: JSX.Element }) =>
  isLoggedIn() ? element : <Navigate to="/login" replace />;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<PrivateRoute element={<HomePage />} />} />
          <Route path="/sessions" element={<PrivateRoute element={<SessionsPage />} />} />
          <Route path="/sessions/:id" element={<PrivateRoute element={<SessionDetailPage />} />} />
          <Route path="/sessions/:id/analysis" element={<PrivateRoute element={<PostAnalysisPage />} />} />
          <Route path="/tracks" element={<PrivateRoute element={<TracksPage />} />} />
          <Route path="/tracks/:id" element={<PrivateRoute element={<TrackDetailPage />} />} />
          <Route path="/progress" element={<PrivateRoute element={<ProgressPage />} />} />
          <Route path="/profile" element={<PrivateRoute element={<ProfilePage />} />} />
          <Route path="/profile/garage" element={<PrivateRoute element={<GaragePage />} />} />
          <Route path="/profile/coach" element={<PrivateRoute element={<CoachPage />} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
