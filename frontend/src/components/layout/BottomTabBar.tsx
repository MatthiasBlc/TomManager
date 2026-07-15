import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface TabItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  show?: boolean;
}

function TabIcon({ d }: { d: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export default function BottomTabBar() {
  const { user } = useAuth();
  const location = useLocation();
  const eventId = location.pathname.match(/\/events\/([^/]+)/)?.[1];
  const navigate = useNavigate();

  if (!user) return null;

  const tabs: TabItem[] = [
    {
      to: "/events",
      icon: (
        <TabIcon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
      ),
      label: "Événements",
    },
    {
      to: `/events/${eventId}/planning`,
      icon: (
        <TabIcon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      ),
      label: "Planning",
      show: !!eventId,
    },
    {
      to: `/events/${eventId}`,
      icon: <TabIcon d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
      label: "Jeux de société",
      show: !!eventId,
    },
  ];

  const visibleTabs = tabs.filter((t) => t.show !== false);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 border-t border-base-300 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] text-xs transition-colors ${
                isActive ? "text-primary" : "text-base-content/60"
              }`
            }
          >
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => navigate("/profile")}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] text-xs text-base-content/60"
        >
          <TabIcon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          <span>{user.username}</span>
        </button>
      </div>
    </nav>
  );
}
