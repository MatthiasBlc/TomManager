import EmptyState from "../common/EmptyState";
import { serviceLabel } from "./units";
import { formatParisDateTime } from "../../utils/dateTime";

interface Person {
  id: string;
  username: string;
  displayName?: string | null;
}

interface ChefEntry extends Person {
  source: "ROLE" | "MANUAL";
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
  assistants: Person[];
}

interface Props {
  chefsCount: number;
  coursesCount: number;
  unassignedCount: number;
  equipierPlanningEnabled: boolean;
  meals: DashboardMeal[];
  chefs: ChefEntry[];
  coursesMembers: Person[];
  unassigned: Person[];
}

const displayedName = (u: Person) => u.displayName ?? u.username;

const formatDateTime = (iso: string) =>
  formatParisDateTime(iso, {
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
  chefs,
  coursesMembers,
  unassigned,
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

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Planning équipier :</span>
        <span className={`badge ${equipierPlanningEnabled ? "badge-success" : "badge-error"}`}>
          {equipierPlanningEnabled ? "Activé" : "Désactivé"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="card bg-base-200 shadow-none">
          <div className="card-body p-3">
            <h4 className="font-semibold text-sm mb-2">Chefs</h4>
            {chefs.length === 0 ? (
              <p className="text-xs opacity-60">Aucun chef pour l'instant.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {chefs.map((c) => (
                  <span key={c.id} className="badge badge-outline">
                    {displayedName(c)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="card bg-base-200 shadow-none">
          <div className="card-body p-3">
            <h4 className="font-semibold text-sm mb-2">Équipe courses</h4>
            {coursesMembers.length === 0 ? (
              <p className="text-xs opacity-60">Aucun membre pour l'instant.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {coursesMembers.map((p) => (
                  <span key={p.id} className="badge badge-outline">
                    {displayedName(p)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="card bg-base-200 shadow-none">
          <div className="card-body p-3">
            <h4 className="font-semibold text-sm mb-2">Sans affectation</h4>
            {unassigned.length === 0 ? (
              <p className="text-xs opacity-60">Tout le monde a un rôle cuisine.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {unassigned.map((p) => (
                  <span key={p.id} className="badge badge-outline">
                    {displayedName(p)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-2">Repas</h3>
        {meals.length === 0 ? (
          <EmptyState icon={<span>🍽️</span>} title="Aucun repas planifié pour l'instant" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
                  {meal.assistants.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {meal.assistants.map((a) => (
                        <span key={a.id} className="badge badge-outline badge-sm">
                          {displayedName(a)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
