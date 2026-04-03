interface TableSummary {
  id: string;
  title: string;
  pitch: string | null;
  maxPlayers: number;
  startDateTime: string;
  endDateTime: string;
  creator: { id: string; username: string };
  tags: { id: string; name: string }[];
  confirmedCount: number;
  waitlistCount: number;
  currentUserStatus: string | null;
  isGM: boolean;
}

interface Props {
  table: TableSummary;
  onClick: () => void;
}

export default function TableCard({ table, onClick }: Props) {
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="card bg-base-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="card-body p-4">
        <div className="flex items-start justify-between">
          <h3 className="card-title text-base">{table.title}</h3>
          {table.isGM && <span className="badge badge-secondary badge-sm">GM</span>}
        </div>

        <p className="text-sm opacity-70">
          {formatTime(table.startDateTime)} - {formatTime(table.endDateTime)}
        </p>

        <p className="text-sm opacity-60">GM: {table.creator.username}</p>

        {table.pitch && <p className="text-sm line-clamp-2">{table.pitch}</p>}

        <div className="flex items-center gap-2 mt-2">
          <span className="badge badge-outline badge-sm">
            {table.confirmedCount}/{table.maxPlayers}
          </span>
          {table.waitlistCount > 0 && (
            <span className="badge badge-warning badge-sm">+{table.waitlistCount} waitlist</span>
          )}
          {table.currentUserStatus && (
            <span
              className={`badge badge-sm ${
                table.currentUserStatus === "CONFIRMED" ? "badge-success" : "badge-warning"
              }`}
            >
              {table.currentUserStatus === "CONFIRMED" ? "Joined" : "Waitlist"}
            </span>
          )}
        </div>

        {table.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {table.tags.map((tag) => (
              <span key={tag.id} className="badge badge-ghost badge-xs">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
