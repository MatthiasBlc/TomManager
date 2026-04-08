import TableCard from "./TableCard";
import EmptyState from "../common/EmptyState";

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
  currentUserConflict: boolean;
  conflictingPlayerCount: number;
}

interface Props {
  tables: TableSummary[];
  onTableClick: (tableId: string) => void;
}

export default function TimelineView({ tables, onTableClick }: Props) {
  if (tables.length === 0) {
    return (
      <EmptyState
        icon={<span>🎯</span>}
        title="No tables yet"
        description="Be the first to create one!"
      />
    );
  }

  // Group tables by date
  const grouped = tables.reduce<Record<string, TableSummary[]>>((acc, table) => {
    const dateKey = new Date(table.startDateTime).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(table);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      {Object.entries(grouped).map(([date, dateTables]) => (
        <div key={date}>
          <h3 className="text-base font-semibold mb-3 capitalize sticky top-0 bg-base-200 py-2 z-10 md:text-lg md:static md:bg-transparent md:py-0">
            {date}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dateTables.map((table) => (
              <TableCard key={table.id} table={table} onClick={() => onTableClick(table.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
