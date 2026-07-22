import EmptyState from "../common/EmptyState";
import { serviceLabel } from "./units";

interface Person {
  id: string;
  username: string;
  displayName?: string | null;
}

interface DashboardMeal {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  endDateTime: string;
  maxAssistants: number;
  remainingSeats: number;
  chef: Person | null;
}

interface Props {
  chefsCount: number;
  coursesCount: number;
  unassignedCount: number;
  equipierPlanningEnabled: boolean;
  meals: DashboardMeal[];
}

const displayedName = (u: Person) => u.displayName ?? u.username;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function KitchenDashboard({
  chefsCount,
  coursesCount,
  unassignedCount,
  equipierPlanningEnabled,
  meals,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="stats stats-vertical sm:stats-horizontal shadow-sm w-full">
        <div className="stat">
          <div className="stat-title">Chefs</div>
          <div className="stat-value text-2xl">{chefsCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Équipe courses</div>
          <div className="stat-value text-2xl">{coursesCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Sans affectation</div>
          <div className="stat-value text-2xl">{unassignedCount}</div>
        </div>
      </div>

      <p className="text-xs opacity-60">
        Planning équipier {equipierPlanningEnabled ? "activé" : "désactivé"} par le responsable.
      </p>

      <div>
        <h3 className="font-semibold text-sm mb-2">Repas</h3>
        {meals.length === 0 ? (
          <EmptyState icon={<span>🍽️</span>} title="Aucun repas planifié pour l'instant" />
        ) : (
          <div className="space-y-2">
            {meals.map((meal) => (
              <div key={meal.id} className="card bg-base-200 shadow-none">
                <div className="card-body p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        {meal.name}
                        <span className="badge badge-outline badge-sm">
                          {serviceLabel(meal.service)}
                        </span>
                        {!meal.chef && (
                          <span className="badge badge-warning badge-sm">sans chef</span>
                        )}
                      </h4>
                      <p className="text-xs opacity-70 mt-0.5">
                        {meal.chef ? displayedName(meal.chef) : "Sans chef"} ·{" "}
                        {formatDateTime(meal.startDateTime)} → {formatDateTime(meal.endDateTime)}
                      </p>
                    </div>
                    <span className="badge badge-ghost badge-sm shrink-0">
                      {meal.maxAssistants - meal.remainingSeats}/{meal.maxAssistants} places
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
