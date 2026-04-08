import { Link } from "react-router-dom";
import ConnectionStatus from "../common/ConnectionStatus";
import NotificationBell from "../notifications/NotificationBell";
import { useAuth } from "../../contexts/AuthContext";

export default function MobileHeader() {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-base-100 border-b border-base-300">
      <div className="flex items-center justify-between h-12 px-3">
        <Link to="/" className="font-bold text-lg">
          TM
        </Link>
        {user && (
          <div className="flex items-center gap-1">
            <ConnectionStatus />
            <NotificationBell />
          </div>
        )}
      </div>
    </header>
  );
}
