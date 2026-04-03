import { Routes, Route } from "react-router-dom";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import InvitationLandingPage from "../pages/InvitationLandingPage";
import EventListPage from "../pages/EventListPage";
import EventDetailPage from "../pages/EventDetailPage";
import PlanningPage from "../pages/PlanningPage";
import TableDetailPage from "../pages/TableDetailPage";
import PrivateRoute from "../components/common/PrivateRoute";
import NotFoundPage from "../pages/NotFoundPage";
import ProfilePage from "../pages/ProfilePage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/invite/:token" element={<InvitationLandingPage />} />
      <Route
        path="/events"
        element={
          <PrivateRoute>
            <EventListPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/events/:eventId"
        element={
          <PrivateRoute>
            <EventDetailPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/events/:eventId/planning"
        element={
          <PrivateRoute>
            <PlanningPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/events/:eventId/planning/:tableId"
        element={
          <PrivateRoute>
            <TableDetailPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <ProfilePage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
