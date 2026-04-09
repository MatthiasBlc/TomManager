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

interface LayoutItem {
  table: TableSummary;
  col: number;
  cssRow: number;
  rowSpan: number;
}

interface Props {
  tables: TableSummary[];
  onTableClick: (tableId: string) => void;
}

function tablesOverlap(a: TableSummary, b: TableSummary): boolean {
  return (
    new Date(a.startDateTime).getTime() < new Date(b.endDateTime).getTime() &&
    new Date(b.startDateTime).getTime() < new Date(a.endDateTime).getTime()
  );
}

// Calcule la position et le rowSpan de chaque table dans une grille CSS.
//
// Principe :
//   - Les tables sont triees par heure de debut.
//   - Affectation greedy des colonnes : une table rejoint la premiere colonne
//     dont la derniere table ne chevauche pas la sienne ; sinon nouvelle colonne.
//   - rowSpan d'une table = nombre max de tables sequentielles dans une autre
//     colonne qu'elle chevauche (permet a une longue table de "couvrir" plusieurs
//     tables courtes dans la colonne voisine).
//   - cssRow d'une table = cumul des rowSpan des tables precedentes dans sa colonne.
//
// Exemple :
//   A 10h-12h | B 11h-16h   ->  A col0 row1    B col1 row1 span2
//   C 14h-16h | B 11h-16h   ->  C col0 row2
export function computeLayout(tables: TableSummary[]): LayoutItem[] {
  const sorted = [...tables].sort(
    (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
  );

  // Affectation greedy des colonnes
  const columns: TableSummary[][] = [];
  const colOf = new Map<string, number>();

  for (const table of sorted) {
    let col = columns.findIndex((c) => !tablesOverlap(c[c.length - 1], table));
    if (col === -1) {
      col = columns.length;
      columns.push([]);
    }
    columns[col].push(table);
    colOf.set(table.id, col);
  }

  // Cas simple : toutes les tables sont sequentielles
  if (columns.length === 1) {
    return sorted.map((table, i) => ({ table, col: 0, cssRow: i + 1, rowSpan: 1 }));
  }

  // Calcul du rowSpan pour chaque table
  const rowSpanOf = new Map<string, number>();
  for (const table of sorted) {
    const col = colOf.get(table.id)!;
    let maxSpan = 1;
    for (let c = 0; c < columns.length; c++) {
      if (c === col) continue;
      const count = columns[c].filter((t) => tablesOverlap(table, t)).length;
      maxSpan = Math.max(maxSpan, count);
    }
    rowSpanOf.set(table.id, maxSpan);
  }

  // Calcul de la ligne CSS : cumul des rowSpan dans chaque colonne
  const cssRowOf = new Map<string, number>();
  for (const col of columns) {
    let row = 1;
    for (const table of col) {
      cssRowOf.set(table.id, row);
      row += rowSpanOf.get(table.id)!;
    }
  }

  return sorted.map((table) => ({
    table,
    col: colOf.get(table.id)!,
    cssRow: cssRowOf.get(table.id)!,
    rowSpan: rowSpanOf.get(table.id)!,
  }));
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
        const numCols = Math.max(...items.map((i) => i.col)) + 1;

        return (
          <div key={date}>
            <h3 className="text-base font-semibold mb-3 capitalize sticky top-0 bg-base-200 py-2 z-10 md:text-lg md:static md:bg-transparent md:py-0">
              {date}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${numCols}, 1fr)`,
                gap: "0.75rem",
              }}
            >
              {items.map(({ table, col, cssRow, rowSpan }) => (
                <div
                  key={table.id}
                  style={{
                    gridColumn: col + 1,
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
