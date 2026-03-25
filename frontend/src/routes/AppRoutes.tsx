import { Routes, Route } from "react-router-dom";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import InvitationLandingPage from "../pages/InvitationLandingPage";
import EventListPage from "../pages/EventListPage";
import EventDetailPage from "../pages/EventDetailPage";
import PlanningPage from "../pages/PlanningPage";
import TableDetailPage from "../pages/TableDetailPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/invite/:token" element={<InvitationLandingPage />} />
      <Route path="/events" element={<EventListPage />} />
      <Route path="/events/:eventId" element={<EventDetailPage />} />
      <Route path="/events/:eventId/planning" element={<PlanningPage />} />
      <Route path="/events/:eventId/planning/:tableId" element={<TableDetailPage />} />
    </Routes>
  );
}
