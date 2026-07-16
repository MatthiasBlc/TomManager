import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import Navbar from "./components/layout/Navbar";
import AppLayout from "./components/layout/AppLayout";
import AppRoutes from "./routes/AppRoutes";
import ErrorBoundary from "./components/common/ErrorBoundary";
import ScrollToTop from "./components/common/ScrollToTop";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useIsMobile } from "./hooks/useIsMobile";

function AppContent() {
  const isOnline = useOnlineStatus();
  const isMobile = useIsMobile();

  // Sur mobile, MobileHeader/BottomTabBar sont `fixed` (hors du flow) : ils
  // gerent eux-memes leur decalage quand hors-ligne (voir MobileHeader/AppLayout).
  // Sur desktop, DesktopNavbar est `sticky` et occupe sa propre place dans le
  // flow : c'est ce padding qui evite qu'il demarre sous le bandeau.
  const wrapperPadding = !isOnline && !isMobile ? "pt-10" : "";

  return (
    <>
      {!isOnline && (
        <div className="bg-warning text-warning-content text-center py-2 text-sm fixed top-0 left-0 right-0 z-[100]">
          Hors connexion
        </div>
      )}
      <div className={wrapperPadding}>
        <ScrollToTop />
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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <ConfirmProvider>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </ConfirmProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
