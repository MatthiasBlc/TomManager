import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/layout/Navbar";
import AppLayout from "./components/layout/AppLayout";
import AppRoutes from "./routes/AppRoutes";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

function AppContent() {
  const isOnline = useOnlineStatus();

  return (
    <>
      {!isOnline && (
        <div className="bg-warning text-warning-content text-center py-2 text-sm fixed top-0 left-0 right-0 z-[100]">
          Hors connexion
        </div>
      )}
      <div className={!isOnline ? "pt-10" : ""}>
        <Navbar />
        <AppLayout>
          <AppRoutes />
        </AppLayout>
        <Toaster position="top-right" />
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
