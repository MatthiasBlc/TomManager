import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { GridIcon, CalendarIcon, DiceIcon, UserIcon } from "../common/icons";

interface TabItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  show?: boolean;
  // NavLink ignore les search params dans son calcul d'actif : les onglets
  // avec ?tab= fournissent leur propre etat actif
  active?: boolean;
}

const tabClass = (active: boolean) =>
  `flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] px-3 py-1 rounded-xl text-[0.68rem] font-semibold transition-colors ${
    active ? "bg-primary/15 text-primary" : "text-base-content/60"
  }`;

export default function BottomTabBar() {
  const { user } = useAuth();
  const location = useLocation();
  const eventId = location.pathname.match(/\/events\/([^/]+)/)?.[1];

  if (!user) return null;

  const tabs: TabItem[] = [
    {
      to: "/events",
      icon: <GridIcon className="h-5 w-5" />,
      label: "Événements",
    },
    {
      to: `/events/${eventId}/planning`,
      icon: <CalendarIcon className="h-5 w-5" />,
      label: "Planning",
      show: !!eventId,
    },
    {
      to: `/events/${eventId}?tab=games`,
      icon: <DiceIcon className="h-5 w-5" />,
      label: "Jeux de société",
      show: !!eventId,
      active:
        location.pathname === `/events/${eventId}` &&
        new URLSearchParams(location.search).get("tab") === "games",
    },
  ];

  const visibleTabs = tabs.filter((t) => t.show !== false);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 border-t border-base-300 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16 px-2">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) => tabClass(tab.active ?? isActive)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
        <NavLink to="/profile" end className={({ isActive }) => tabClass(isActive)}>
          <UserIcon className="h-5 w-5" />
          <span>Profil</span>
        </NavLink>
      </div>
    </nav>
  );
}
