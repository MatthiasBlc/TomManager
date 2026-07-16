import { useNavigate } from "react-router-dom";
import type { Notification } from "../../hooks/useNotifications";

interface Props {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
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

export default function NotificationItem({ notification, onMarkAsRead, onDelete }: Props) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    // Navigate to relevant page based on metadata ; si la notification porte
    // sur une table precise, deep-link vers sa modale (?table=)
    if (notification.metadata?.eventId) {
      const base = `/events/${notification.metadata.eventId}/planning`;
      const tableId = notification.metadata.tableId;
      navigate(tableId ? `${base}?table=${tableId}` : base);
    }
  };

  return (
    <div
      className={`flex items-start gap-2 p-3 cursor-pointer hover:bg-base-200 active:scale-[0.98] transition-all ${
        !notification.read ? "bg-base-200/50" : ""
      }`}
      onClick={handleClick}
    >
      <span className="text-lg flex-shrink-0">{getIcon(notification.type)}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight ${!notification.read ? "font-semibold" : ""}`}>
          {notification.title}
        </p>
        <p className="text-xs opacity-70 mt-0.5 truncate">{notification.message}</p>
        <p className="text-xs opacity-50 mt-1">{formatTimeAgo(notification.createdAt)}</p>
      </div>
      <button
        className="btn btn-ghost btn-xs flex-shrink-0 opacity-50 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        aria-label="Supprimer la notification"
      >
        ✕
      </button>
    </div>
  );
}
