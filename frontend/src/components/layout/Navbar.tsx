import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import ConnectionStatus from "../common/ConnectionStatus";
import NotificationBell from "../notifications/NotificationBell";
import { useIsMobile } from "../../hooks/useIsMobile";
import MobileHeader from "./MobileHeader";
import BottomTabBar from "./BottomTabBar";

function DesktopNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
      toast.success("Deconnecte");
    } catch {
      toast.error("Echec de la deconnexion");
    }
  };

  return (
    <div className="navbar bg-base-100 shadow-sm sticky top-0 z-50">
      <div className="flex-1">
        <Link to="/" className="btn btn-ghost text-xl">
          TomManager
        </Link>
      </div>
      <div className="flex-none flex items-center gap-2">
        {user && (
          <>
            <Link to="/events" className="btn btn-ghost btn-sm">
              Evenements
            </Link>
            <ConnectionStatus />
            <NotificationBell />
            <Link to="/profile" className="flex items-center gap-2 hover:opacity-80">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="w-7 h-7 rounded-full" />
              ) : null}
              <span className="text-sm opacity-70">{user.username}</span>
            </Link>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">
              Se deconnecter
            </button>
          </>
        )}
        {!user && (
          <Link to="/login" className="btn btn-primary btn-sm">
            Connexion
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Navbar() {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  if (isMobile) {
    return (
      <>
        <MobileHeader />
        {user && <BottomTabBar />}
      </>
    );
  }

  return <DesktopNavbar />;
}
