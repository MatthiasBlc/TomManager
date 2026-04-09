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
  colSpan: number;
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

// Calcule le layout interne d'un groupe de tables qui se chevauchent toutes (au moins transitivement).
// Retourne les items avec col/cssRow/rowSpan locaux (cssRow commence a 1) et le nombre de colonnes.
function computeGroupLayout(
  tables: TableSummary[]
): { items: Omit<LayoutItem, "colSpan">[]; numCols: number } {
  const sorted = [...tables].sort(
    (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
  );

  if (tables.length === 1) {
    return { items: [{ table: tables[0], col: 0, cssRow: 1, rowSpan: 1 }], numCols: 1 };
  }

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

  if (columns.length === 1) {
    return {
      items: sorted.map((table, i) => ({ table, col: 0, cssRow: i + 1, rowSpan: 1 })),
      numCols: 1,
    };
  }

  // rowSpan = max de tables sequentielles dans une autre colonne qui chevauchent cette table
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

  // cssRow = cumul des rowSpan dans chaque colonne
  const cssRowOf = new Map<string, number>();
  for (const col of columns) {
    let row = 1;
    for (const table of col) {
      cssRowOf.set(table.id, row);
      row += rowSpanOf.get(table.id)!;
    }
  }

  return {
    items: sorted.map((table) => ({
      table,
      col: colOf.get(table.id)!,
      cssRow: cssRowOf.get(table.id)!,
      rowSpan: rowSpanOf.get(table.id)!,
    })),
    numCols: columns.length,
  };
}

// Calcule la position de chaque table dans une grille CSS.
//
// Principe :
//   1. Trouver les composantes connexes par chevauchement (union-find).
//   2. Les groupes d'une seule table (pas de chevauchement) s'etirent sur toute la largeur.
//   3. Les groupes avec plusieurs tables utilisent l'algorithme greedy par colonnes.
//   4. Les groupes sont empiles verticalement par ordre chronologique (offset de ligne global).
//
// Exemple July 20 :
//   Spirit Island 02h-05h (seul) → pleine largeur, ligne 1
//   Alien | Delta Green | Dungeon World → lignes 2-3
//   Mothership | (vide) | Dungeon World (suite)
export function computeLayout(tables: TableSummary[]): LayoutItem[] {
  if (tables.length === 0) return [];

  // Union-find pour les composantes connexes
  const parent = new Map<string, string>(tables.map((t) => [t.id, t.id]));
  const find = (id: string): string => {
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      if (tablesOverlap(tables[i], tables[j])) union(tables[i].id, tables[j].id);
    }
  }

  const groupMap = new Map<string, TableSummary[]>();
  for (const t of tables) {
    const root = find(t.id);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(t);
  }

  // Trier les groupes par heure de debut
  const groups = [...groupMap.values()].sort(
    (a, b) =>
      Math.min(...a.map((t) => new Date(t.startDateTime).getTime())) -
      Math.min(...b.map((t) => new Date(t.startDateTime).getTime()))
  );

  // Layout de chaque groupe
  const groupLayouts = groups.map((group) => computeGroupLayout(group));

  // Nombre de colonnes global = max sur tous les groupes
  const globalNumCols = Math.max(...groupLayouts.map((g) => g.numCols));

  // Assembler avec offset de ligne global
  const result: LayoutItem[] = [];
  let rowOffset = 0;

  for (const { items, numCols } of groupLayouts) {
    const localMaxRow = Math.max(...items.map((i) => i.cssRow + i.rowSpan - 1));
    // Un groupe d'une seule table sans chevauchement s'etire sur toute la largeur
    const isIsolated = items.length === 1 && numCols === 1;

    for (const item of items) {
      result.push({
        ...item,
        cssRow: item.cssRow + rowOffset,
        colSpan: isIsolated ? globalNumCols : 1,
      });
    }

    rowOffset += localMaxRow;
  }

  return result;
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
