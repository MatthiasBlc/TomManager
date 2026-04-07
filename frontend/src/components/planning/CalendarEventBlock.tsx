import { EventContentArg } from "@fullcalendar/core";

interface TableExtendedProps {
  isGM: boolean;
  currentUserStatus: string | null;
  confirmedCount: number;
  maxPlayers: number;
  waitlistCount: number;
  type: "JDR" | "JDS";
  currentUserConflict: boolean;
  conflictingPlayerCount: number;
}

export default function CalendarEventBlock({ arg }: { arg: EventContentArg }) {
  const {
    isGM,
    currentUserStatus,
    confirmedCount,
    maxPlayers,
    waitlistCount,
    type,
    currentUserConflict,
    conflictingPlayerCount,
  } = arg.event.extendedProps as TableExtendedProps;

  let classes = "bg-primary/80 border-primary text-primary-content";
  if (currentUserConflict) classes = "bg-error border-error text-error-content";
  else if (isGM) classes = "bg-secondary border-secondary text-secondary-content";
  else if (currentUserStatus === "CONFIRMED")
    classes = "bg-success border-success text-success-content";
  else if (currentUserStatus === "WAITLIST")
    classes = "bg-warning border-warning text-warning-content";

  return (
    <div
      className={`h-full w-full overflow-hidden rounded border-l-[3px] px-1 py-0.5 ${classes}`}
      style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)" }}
    >
      <p className="truncate text-xs font-semibold leading-tight">{arg.event.title}</p>
      <span className="badge badge-outline badge-xs opacity-80">{type}</span>
      <p className="text-xs opacity-80">{arg.timeText}</p>
      <p className="text-xs opacity-70">
        {confirmedCount}/{maxPlayers}
        {waitlistCount > 0 && ` +${waitlistCount}`}
      </p>
      {currentUserConflict && (
        <p className="text-xs font-semibold">⚠ Conflit</p>
      )}
      {!currentUserConflict && isGM && conflictingPlayerCount > 0 && (
        <p className="text-xs font-semibold">⚠ {conflictingPlayerCount} conflit{conflictingPlayerCount > 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
