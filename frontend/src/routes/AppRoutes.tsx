import { Routes, Route } from "react-router-dom";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import InvitationLandingPage from "../pages/InvitationLandingPage";
import EventListPage from "../pages/EventListPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/invite/:token" element={<InvitationLandingPage />} />
      <Route path="/events" element={<EventListPage />} />
    </Routes>
  );
}
