import TableCard from "./TableCard";
import MealSlotCard from "./MealSlotCard";
import EmptyState from "../common/EmptyState";
import { useIsMobile } from "../../hooks/useIsMobile";
import { computeLayout, type TableSummary } from "./computeLayout";
import { type MealSlot } from "./kitchenSlots";
import { formatParisDate, parisDayKey } from "../../utils/dateTime";

interface Props {
  tables: TableSummary[];
  mealSlots?: MealSlot[];
  onTableClick: (tableId: string) => void;
}

interface DayGroup {
  key: string;
  label: string;
  tables: TableSummary[];
  meals: MealSlot[];
}

const dayLabel = (iso: string) =>
  formatParisDate(iso, { weekday: "long", day: "numeric", month: "long" });

export default function TimelineView({ tables, mealSlots = [], onTableClick }: Props) {
  const isMobile = useIsMobile();

  if (tables.length === 0 && mealSlots.length === 0) {
    return (
      <EmptyState
        icon={<span>🎯</span>}
        title="Aucune table pour l'instant"
        description="Soyez le premier a en creer une !"
      />
    );
  }

  // Groupement par jour calendaire Paris (cle triable lexicalement), tables et
  // repas fusionnes sous la meme cle de journee
  const days = new Map<string, DayGroup>();
  const ensureDay = (iso: string): DayGroup => {
    const key = parisDayKey(iso);
    if (!days.has(key)) {
      days.set(key, { key, label: dayLabel(iso), tables: [], meals: [] });
    }
    return days.get(key)!;
  };
  tables.forEach((t) => ensureDay(t.startDateTime).tables.push(t));
  mealSlots.forEach((m) => ensureDay(m.startDateTime).meals.push(m));

  const orderedDays = [...days.values()].sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="space-y-6 animate-fade-in">
      {orderedDays.map((day) => {
        const items = computeLayout(day.tables);
        // Nombre de colonnes = max(col + colSpan) sur tous les items
        const gridCols = Math.max(1, ...items.map((i) => i.col + i.colSpan));
        const sortedMeals = [...day.meals].sort(
          (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
        );

        return (
          <div key={day.key}>
            <h3 className="text-base font-semibold mb-3 capitalize sticky top-0 bg-base-200 py-2 z-10 md:text-lg md:static md:bg-transparent md:py-0">
              {day.label}
            </h3>

            {day.tables.length > 0 &&
              (isMobile ? (
                /* Mobile : une seule colonne chronologique — les colonnes paralleles
                   rendraient les cartes illisibles sur 390px (conflit signale par badge) */
                <div className="space-y-3">
                  {[...day.tables]
                    .sort(
                      (a, b) =>
                        new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
                    )
                    .map((table) => (
                      <TableCard
                        key={table.id}
                        table={table}
                        onClick={() => onTableClick(table.id)}
                      />
                    ))}
                </div>
              ) : (
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
              ))}

            {sortedMeals.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">
                  Repas
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedMeals.map((meal) => (
                    <MealSlotCard key={meal.id} meal={meal} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
