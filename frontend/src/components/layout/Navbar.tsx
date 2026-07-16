import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useDiscordLogin } from "../../hooks/useDiscordLogin";
import toast from "react-hot-toast";
import DiscordIcon from "../common/DiscordIcon";
import ConnectionStatus from "../common/ConnectionStatus";
import NotificationBell from "../notifications/NotificationBell";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import MobileHeader from "./MobileHeader";
import BottomTabBar from "./BottomTabBar";

function DesktopNavbar({ isOnline }: { isOnline: boolean }) {
  const { user, logout } = useAuth();
  const { login, connecting, discordAvailable } = useDiscordLogin("/");
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
      toast.success("Déconnecté");
    } catch {
      toast.error("Échec de la déconnexion");
    }
  };

  return (
    <div className={`navbar bg-base-100 shadow-sm sticky z-50 ${isOnline ? "top-0" : "top-10"}`}>
      <div className="flex-1">
        <Link to="/" className="btn btn-ghost text-xl">
          TomManager
        </Link>
      </div>
      <div className="flex-none flex items-center gap-2">
        {user && (
          <>
            <Link to="/events" className="btn btn-ghost btn-sm">
              Événements
            </Link>
            <ConnectionStatus />
            <NotificationBell />
            <Link to="/profile" className="flex items-center gap-2 hover:opacity-80">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="w-7 h-7 rounded-full" />
              ) : null}
              <span className="text-sm opacity-70">{user.displayName ?? user.username}</span>
            </Link>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">
              Se déconnecter
            </button>
          </>
        )}
        {!user && discordAvailable && (
          <button
            type="button"
            className="btn btn-primary btn-sm gap-2"
            onClick={login}
            disabled={connecting}
          >
            {connecting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <DiscordIcon size={16} />
            )}
            Connexion avec Discord
          </button>
        )}
      </div>
    </div>
  );
}

export default function Navbar() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  if (isMobile) {
    return (
      <>
        <MobileHeader isOnline={isOnline} />
        {user && <BottomTabBar />}
      </>
    );
  }

  return <DesktopNavbar isOnline={isOnline} />;
}
