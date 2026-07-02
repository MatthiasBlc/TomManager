import TableCard from "./TableCard";
import EmptyState from "../common/EmptyState";
import { computeLayout, type TableSummary } from "./computeLayout";

interface Props {
  tables: TableSummary[];
  onTableClick: (tableId: string) => void;
}

export default function TimelineView({ tables, onTableClick }: Props) {
  if (tables.length === 0) {
    return (
      <EmptyState
        icon={<span>🎯</span>}
        title="Aucune table pour l'instant"
        description="Soyez le premier a en creer une !"
      />
    );
  }

  // Groupement par jour
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
      {Object.entries(grouped).map(([date, dateTables]) => {
        const items = computeLayout(dateTables);
        // Nombre de colonnes = max(col + colSpan) sur tous les items
        const gridCols = Math.max(1, ...items.map((i) => i.col + i.colSpan));

        return (
          <div key={date}>
            <h3 className="text-base font-semibold mb-3 capitalize sticky top-0 bg-base-200 py-2 z-10 md:text-lg md:static md:bg-transparent md:py-0">
              {date}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gap: "0.75rem",
              }}
            >
              {items.map(({ table, col, colSpan, cssRow, rowSpan }) => (
                <div
                  key={table.id}
                  className="min-w-0"
                  style={{
                    gridColumn: colSpan > 1 ? "1 / -1" : col + 1,
                    gridRow: `${cssRow} / span ${rowSpan}`,
                  }}
                >
                  <TableCard table={table} onClick={() => onTableClick(table.id)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
