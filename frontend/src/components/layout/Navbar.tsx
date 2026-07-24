import { Link, NavLink, useNavigate } from "react-router-dom";
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

  const initials = (user?.displayName ?? user?.username ?? "").trim().slice(0, 2).toUpperCase();

  return (
    <div
      className={`navbar bg-base-100 border-b border-base-300 sticky z-50 ${isOnline ? "top-0" : "top-10"}`}
    >
      <div className="flex-1">
        <Link
          to="/"
          className="flex items-center gap-2 font-serif text-xl font-bold tracking-tight hover:opacity-80"
        >
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          TomManager
        </Link>
      </div>
      <div className="flex-none flex items-center gap-1.5">
        {user && (
          <>
            <NavLink
              to="/events"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  isActive ? "bg-primary/15 text-primary" : "text-base-content/70 hover:bg-base-200"
                }`
              }
            >
              Événements
            </NavLink>
            <ConnectionStatus />
            <NotificationBell />
            <Link
              to="/profile"
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-base-200 transition-colors"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="w-7 h-7 rounded-full" />
              ) : (
                <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                  {initials}
                </span>
              )}
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
