import { type TableSummary, formatSeatSummary } from "./computeLayout";

interface TableCardTableSummary extends TableSummary {
  boardGame?: { id: string; name: string } | null;
}

interface Props {
  table: TableCardTableSummary;
  onClick: () => void;
}

export default function TableCard({ table, onClick }: Props) {
  const typeLabel = table.type === "JDR" ? "JDR" : "JDS";
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const hasGmPlayerConflict =
    table.isGM && !table.currentUserConflict && table.conflictingPlayerCount > 0;

  const seatSummary = formatSeatSummary(table);

  return (
    <div
      className={`card bg-base-100 border h-full overflow-hidden transition-all cursor-pointer hover:shadow-lg active:scale-[0.98] ${
        table.currentUserConflict
          ? "border-error border-2"
          : "border-base-content/15 hover:border-base-content/30"
      }`}
      onClick={onClick}
    >
      <div className="card-body p-4">
        <div className="flex items-start justify-between flex-wrap gap-1">
          <div className="min-w-0">
            <h3 className="card-title text-base truncate">{table.title}</h3>
            {table.boardGame && (
              <p className="text-xs opacity-60 mt-0.5 truncate">{table.boardGame.name}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span
              className={`badge badge-sm ${table.type === "JDR" ? "badge-primary" : "badge-accent"}`}
            >
              {typeLabel}
            </span>
            {table.isGM && <span className="badge badge-secondary badge-sm">MJ</span>}
            {table.currentUserConflict && (
              <span className="badge badge-error badge-sm">⚠ Conflit</span>
            )}
            {hasGmPlayerConflict && (
              <span className="badge badge-error badge-sm">
                ⚠ {table.conflictingPlayerCount} conflit
                {table.conflictingPlayerCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <p className="text-sm opacity-70">
          {formatTime(table.startDateTime)} - {formatTime(table.endDateTime)}
        </p>

        <p className="text-sm opacity-60 truncate">MJ : {table.creator.username}</p>

        {table.pitch && <p className="text-sm line-clamp-2">{table.pitch}</p>}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="badge badge-warning badge-sm">{seatSummary.total}</span>
          {seatSummary.normal && <span className="text-xs opacity-70">{seatSummary.normal}</span>}
          {seatSummary.reserved && (
            <span className="text-xs opacity-70">{seatSummary.reserved}</span>
          )}
          {table.waitlistCount > 0 && (
            <span className="badge badge-warning badge-sm">
              +{table.waitlistCount} en liste d'attente
            </span>
          )}
          {table.currentUserStatus && (
            <span
              className={`badge badge-sm ${
                table.currentUserStatus === "CONFIRMED" ? "badge-success" : "badge-warning"
              }`}
            >
              {table.currentUserStatus === "CONFIRMED" ? "Inscrit" : "Liste d'attente"}
            </span>
          )}
        </div>

        {table.players.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {table.players.map((p) => (
              <span
                key={p.id}
                className={`badge badge-xs max-w-full truncate ${
                  p.isOnReservedSeat ? "badge-warning" : "badge-outline opacity-70"
                }`}
              >
                {p.username}
              </span>
            ))}
          </div>
        )}

        {table.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
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
