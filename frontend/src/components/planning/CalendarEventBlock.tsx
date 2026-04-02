import { EventContentArg } from "@fullcalendar/core";

interface TableExtendedProps {
  isGM: boolean;
  currentUserStatus: string | null;
  confirmedCount: number;
  maxPlayers: number;
  waitlistCount: number;
}

export default function CalendarEventBlock({ arg }: { arg: EventContentArg }) {
  const { isGM, currentUserStatus, confirmedCount, maxPlayers, waitlistCount } =
    arg.event.extendedProps as TableExtendedProps;

  let classes =
    "bg-primary/80 border-primary text-primary-content";
  if (isGM)
    classes = "bg-secondary border-secondary text-secondary-content";
  else if (currentUserStatus === "CONFIRMED")
    classes = "bg-success border-success text-success-content";
  else if (currentUserStatus === "WAITLIST")
    classes = "bg-warning border-warning text-warning-content";

  return (
    <div
      className={`h-full w-full overflow-hidden rounded border-l-[3px] px-1 py-0.5 ${classes}`}
    >
      <p className="truncate text-xs font-semibold leading-tight">
        {arg.event.title}
      </p>
      <p className="text-xs opacity-80">{arg.timeText}</p>
      <p className="text-xs opacity-70">
        {confirmedCount}/{maxPlayers}
        {waitlistCount > 0 && ` +${waitlistCount}`}
      </p>
    </div>
  );
}
