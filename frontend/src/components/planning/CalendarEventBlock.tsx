import { EventContentArg } from "@fullcalendar/core";
import { formatSeatSummary } from "./computeLayout";

interface TableExtendedProps {
  isGM: boolean;
  currentUserStatus: string | null;
  confirmedCount: number;
  maxPlayers: number;
  reservedSeats: number;
  waitlistCount: number;
  confirmedOnReserved: number;
  type: "JDR" | "JDS";
  currentUserConflict: boolean;
  conflictingPlayerCount: number;
  players: { id: string; username: string; displayName?: string | null }[];
  gmUsername: string;
  tags: { id: string; name: string }[];
}

export default function CalendarEventBlock({ arg }: { arg: EventContentArg }) {
  const {
    isGM,
    currentUserStatus,
    confirmedCount,
    maxPlayers,
    reservedSeats,
    waitlistCount,
    confirmedOnReserved,
    type,
    currentUserConflict,
    conflictingPlayerCount,
    players = [],
    gmUsername,
    tags = [],
  } = arg.event.extendedProps as TableExtendedProps;

  const seatSummary = formatSeatSummary({
    confirmedCount,
    maxPlayers,
    reservedSeats,
    confirmedOnReserved,
  });

  // La bordure gauche indique toujours le type (JDR = primary, JDS = accent)
  const borderClass = type === "JDR" ? "border-primary" : "border-accent";

  // Le fond indique le statut de l'utilisateur, avec le type comme couleur par defaut
  let bgClasses =
    type === "JDR" ? "bg-primary/80 text-primary-content" : "bg-accent/80 text-accent-content";
  if (currentUserConflict) bgClasses = "bg-error/80 text-error-content";
  else if (isGM) bgClasses = "bg-secondary/80 text-secondary-content";
  else if (currentUserStatus === "CONFIRMED") bgClasses = "bg-success/80 text-success-content";
  else if (currentUserStatus === "WAITLIST") bgClasses = "bg-warning/80 text-warning-content";

  return (
    <div
      className={`h-full w-full overflow-hidden rounded border-l-[3px] px-1 py-0.5 ${borderClass} ${bgClasses}`}
      style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)" }}
    >
      <p className="text-xs font-semibold leading-tight break-words">{arg.event.title}</p>
      <span className="badge badge-outline badge-xs opacity-80 max-w-full truncate">{type}</span>
      <p className="text-xs opacity-80 truncate">{arg.timeText}</p>
      <p className="text-xs opacity-70 truncate">MJ : {gmUsername}</p>
      <p className="text-xs opacity-70">
        <span className="badge badge-warning badge-xs max-w-full truncate">
          {seatSummary.total}
        </span>
      </p>
      {seatSummary.reserved && (
        <p className="text-xs opacity-70 truncate">
          {seatSummary.normal} · {seatSummary.reserved}
        </p>
      )}
      {waitlistCount > 0 && (
        <p className="text-xs opacity-70 truncate">+{waitlistCount} en attente</p>
      )}
      {currentUserConflict && <p className="text-xs font-semibold truncate">⚠ Conflit</p>}
      {!currentUserConflict && isGM && conflictingPlayerCount > 0 && (
        <p className="text-xs font-semibold truncate">
          ⚠ {conflictingPlayerCount} conflit
          {conflictingPlayerCount > 1 ? "s" : ""}
        </p>
      )}
      {players.length > 0 && (
        <p className="text-xs opacity-70 truncate">
          {players.map((p) => p.displayName ?? p.username).join(", ")}
        </p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-0.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="badge badge-ghost badge-xs opacity-80 max-w-full truncate"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
