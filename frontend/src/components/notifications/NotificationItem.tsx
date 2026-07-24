import { useNavigate } from "react-router-dom";
import type { Notification } from "../../hooks/useNotifications";
import { CloseIcon } from "../common/icons";

interface Props {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate?: () => void;
}

// Teinte de la pastille selon la nature de l'evenement (succes/alerte/erreur/info),
// l'emoji lui-meme reste inchange (convention appli hors Cuisine).
function getTint(type: string): string {
  switch (type) {
    case "WAITLIST_PROMOTED":
    case "KITCHEN_SWAP_ACCEPTED":
    case "KITCHEN_ASSISTANT_SWAP_ACCEPTED":
    case "KITCHEN_CHEF_ADDED":
    case "KITCHEN_MEAL_CLAIMED":
    case "GM_PLAYER_JOINED":
    case "GM_TABLE_FULL":
      return "bg-success/15 text-success";
    case "WAITLIST_DEMOTED":
    case "GM_PLAYER_WAITLISTED":
    case "KITCHEN_OVERCAPACITY":
      return "bg-warning/15 text-warning";
    case "TABLE_DELETED":
    case "PLAYER_KICKED":
    case "PARTICIPANT_REMOVED":
    case "EVENT_DELETED":
    case "KITCHEN_SWAP_REJECTED":
    case "KITCHEN_CHEF_REMOVED":
    case "GM_PLAYER_LEFT":
      return "bg-error/15 text-error";
    default:
      return "bg-primary/15 text-primary";
  }
}

function getIcon(type: string): string {
  switch (type) {
    case "TABLE_DELETED":
      return "🗑";
    case "TABLE_UPDATED":
      return "✏";
    case "WAITLIST_PROMOTED":
      return "⬆";
    case "WAITLIST_DEMOTED":
      return "⬇";
    case "RESERVED_SEAT_ASSIGNED":
      return "🔒";
    case "PLAYER_KICKED":
      return "🚫";
    case "PARTICIPANT_REMOVED":
      return "👋";
    case "EVENT_UPDATED":
      return "📅";
    case "EVENT_DELETED":
      return "📅";
    case "GM_PLAYER_JOINED":
      return "🙋";
    case "GM_PLAYER_WAITLISTED":
      return "⏳";
    case "GM_PLAYER_LEFT":
      return "👋";
    case "GM_TABLE_FULL":
      return "🎉";
    case "KITCHEN_SWAP_REQUESTED":
    case "KITCHEN_ASSISTANT_SWAP_REQUESTED":
      return "🔄";
    case "KITCHEN_SWAP_ACCEPTED":
    case "KITCHEN_ASSISTANT_SWAP_ACCEPTED":
      return "✅";
    case "KITCHEN_SWAP_REJECTED":
      return "❌";
    case "KITCHEN_CHEF_ADDED":
    case "KITCHEN_MEAL_CLAIMED":
      return "👨‍🍳";
    case "KITCHEN_CHEF_REMOVED":
      return "👋";
    case "KITCHEN_OVERCAPACITY":
      return "⚠";
    default:
      return "🔔";
  }
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

// Destination au clic selon le type : les notifications qui retirent un acces
// (event supprime, retrait d'event) ne doivent pas deep-linker vers une page
// desormais interdite (403), et une table supprimee n'a plus de modale a ouvrir
function getDestination(notification: Notification): string | null {
  const eventId = notification.metadata?.eventId;
  switch (notification.type) {
    case "EVENT_DELETED":
    case "PARTICIPANT_REMOVED":
      return "/events";
    case "TABLE_DELETED":
    case "PLAYER_KICKED":
    case "EVENT_UPDATED":
      return eventId ? `/events/${eventId}/planning` : null;
    case "KITCHEN_SWAP_REQUESTED":
    case "KITCHEN_SWAP_ACCEPTED":
    case "KITCHEN_SWAP_REJECTED":
    case "KITCHEN_ASSISTANT_SWAP_REQUESTED":
    case "KITCHEN_ASSISTANT_SWAP_ACCEPTED":
    case "KITCHEN_CHEF_ADDED":
    case "KITCHEN_CHEF_REMOVED":
    case "KITCHEN_MEAL_CLAIMED":
    case "KITCHEN_OVERCAPACITY":
      return eventId ? `/events/${eventId}?tab=kitchen` : null;
    default: {
      // TABLE_UPDATED, WAITLIST_*, RESERVED_SEAT_ASSIGNED et tout type futur :
      // deep-link vers la modale de la table si connue
      if (!eventId) return null;
      const base = `/events/${eventId}/planning`;
      const tableId = notification.metadata?.tableId;
      return tableId ? `${base}?table=${tableId}` : base;
    }
  }
}

export default function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onNavigate,
}: Props) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    onNavigate?.();
    const destination = getDestination(notification);
    if (destination) {
      navigate(destination);
    }
  };

  return (
    <div
      className={`relative flex items-start gap-2.5 p-3 cursor-pointer hover:bg-base-200 active:scale-[0.98] transition-all ${
        !notification.read ? "bg-base-200/50" : ""
      }`}
      onClick={handleClick}
    >
      {!notification.read && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" />
      )}
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${getTint(
          notification.type
        )}`}
      >
        {getIcon(notification.type)}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight ${!notification.read ? "font-semibold" : ""}`}>
          {notification.title}
        </p>
        <p className="text-xs opacity-70 mt-0.5 truncate">{notification.message}</p>
        <p
          className="text-xs opacity-50 mt-1"
          title={new Date(notification.createdAt).toLocaleString("fr-FR")}
        >
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>
      <button
        className="btn btn-ghost btn-xs btn-square flex-shrink-0 opacity-50 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        aria-label="Supprimer la notification"
      >
        <CloseIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
