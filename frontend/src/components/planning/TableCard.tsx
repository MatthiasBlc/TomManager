import { type TableSummary, formatSeatSummary } from "./computeLayout";
import { formatParisTime } from "../../utils/dateTime";
import { CARD } from "../common/ui";
import PersonAvatar from "../common/PersonAvatar";
import { AlertTriangleIcon } from "../common/icons";

interface TableCardTableSummary extends TableSummary {
  boardGame?: { id: string; name: string } | null;
}

interface Props {
  table: TableCardTableSummary;
  onClick: () => void;
}

export default function TableCard({ table, onClick }: Props) {
  const typeLabel = table.type === "JDR" ? "JDR" : "JDS";

  const hasGmPlayerConflict =
    table.isGM && !table.currentUserConflict && table.conflictingPlayerCount > 0;

  const conflictBadge = table.currentUserConflict ? (
    <span className="badge badge-error badge-sm gap-1 shrink-0">
      <AlertTriangleIcon className="w-3 h-3" />
      Conflit
    </span>
  ) : hasGmPlayerConflict ? (
    <span className="badge badge-error badge-sm gap-1 shrink-0">
      <AlertTriangleIcon className="w-3 h-3" />
      {table.conflictingPlayerCount} conflit{table.conflictingPlayerCount > 1 ? "s" : ""}
    </span>
  ) : null;

  const statusBadge = table.currentUserStatus ? (
    <span
      className={`badge badge-sm shrink-0 ${
        table.currentUserStatus === "CONFIRMED" ? "badge-success" : "badge-warning"
      }`}
    >
      {table.currentUserStatus === "CONFIRMED" ? "Inscrit" : "Liste d'attente"}
    </span>
  ) : null;

  const seatSummary = formatSeatSummary(table);
  const isFull = table.maxPlayers > 0 && table.confirmedCount >= table.maxPlayers;
  const fillPct =
    table.maxPlayers > 0 ? Math.min(100, (table.confirmedCount / table.maxPlayers) * 100) : 0;

  const captionParts = [seatSummary.total];
  if (seatSummary.normal) captionParts.push(seatSummary.normal);
  if (seatSummary.reserved) captionParts.push(seatSummary.reserved);
  if (table.waitlistCount > 0) captionParts.push(`+${table.waitlistCount} en liste d'attente`);

  const borderClass = conflictBadge
    ? "border-l-error"
    : isFull
      ? "border-l-success"
      : "border-l-info";

  return (
    <div
      className={`${CARD} h-full overflow-hidden transition-all cursor-pointer hover:bg-base-300 active:scale-[0.98] border-l-4 ${borderClass}`}
      onClick={onClick}
    >
      <div className="card-body p-3 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-[0.68rem] uppercase tracking-wider font-bold opacity-50">
              {formatParisTime(table.startDateTime)} - {formatParisTime(table.endDateTime)}
            </p>
            <p className="font-serif text-base font-semibold leading-tight mt-0.5 truncate">
              {table.title}
            </p>
            {table.boardGame && (
              <p className="text-xs opacity-60 mt-0.5 truncate">{table.boardGame.name}</p>
            )}
          </div>
          <span
            className={`badge badge-sm shrink-0 ${table.type === "JDR" ? "badge-primary" : "badge-accent"}`}
          >
            {typeLabel}
          </span>
        </div>

        <div className="h-px bg-base-300" />

        {(statusBadge || (conflictBadge && table.type !== "JDR")) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusBadge}
            {table.type !== "JDR" && conflictBadge}
          </div>
        )}

        {table.type === "JDR" && (
          <div className="flex items-center gap-2">
            <span className="text-[0.68rem] uppercase tracking-wide font-bold opacity-50 w-9 shrink-0">
              MJ
            </span>
            <span className="flex items-center gap-2 text-sm truncate min-w-0">
              <PersonAvatar name={table.creator.displayName ?? table.creator.username} />
              <span className="truncate">
                {table.creator.displayName ?? table.creator.username}
              </span>
            </span>
            {conflictBadge && <span className="ml-auto">{conflictBadge}</span>}
          </div>
        )}

        {table.pitch && <p className="text-sm opacity-80 line-clamp-2">{table.pitch}</p>}

        <div className="flex items-center gap-2">
          <span className="text-[0.68rem] uppercase tracking-wide font-bold opacity-50 w-9 shrink-0">
            Places
          </span>
          <div className="flex-1 min-w-0">
            <div className="h-1.5 w-full rounded-full bg-base-300 overflow-hidden">
              <div
                className={`h-full rounded-full ${isFull ? "bg-success" : "bg-info"}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <div className="text-xs opacity-50 mt-1 tabular-nums truncate">
              {captionParts.join(" · ")}
            </div>
          </div>
        </div>

        {table.players.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {table.players.map((p) => (
              <span
                key={p.id}
                className={`badge badge-xs max-w-full truncate ${
                  p.isOnReservedSeat ? "badge-warning" : "badge-ghost"
                }`}
              >
                {p.displayName ?? p.username}
              </span>
            ))}
          </div>
        )}

        {table.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {table.tags.map((tag) => (
              <span key={tag.id} className="badge badge-ghost badge-xs max-w-full truncate">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
