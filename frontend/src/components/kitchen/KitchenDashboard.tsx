import EmptyState from "../common/EmptyState";
import { serviceLabel } from "./units";
import { formatParisDate } from "../../utils/dateTime";
import { CARD, SectionEyebrow } from "../common/ui";
import PersonAvatar from "../common/PersonAvatar";
import {
  UsersIcon,
  UtensilsIcon,
  EyeIcon,
  EyeOffIcon,
  ShoppingCartIcon,
  InfoCircleIcon,
  AlertTriangleIcon,
} from "../common/icons";

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
  // Absents si l'utilisateur courant ne voit pas la repartition (jamais le cas ici,
  // le dashboard admin simple est dans le perimetre KitchenDietSplit).
  vegeCount?: number;
  carneCount?: number;
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
  eventParticipantsCount?: number;
}

const displayedName = (u: Person) => u.displayName ?? u.username;

// Label court "jour . service" (ex: "vendredi . Soir"), coherent avec
// MealFichesList (vue Gestion) pour garder les deux ecrans alignes.
const whenLabel = (meal: { service: string; startDateTime: string }) =>
  `${formatParisDate(meal.startDateTime, { weekday: "long" })} · ${serviceLabel(meal.service)}`;

// Vue d'ensemble en lecture seule (admin ni responsable ni chef) : memes tokens
// visuels que KitchenManagementPanel/MealFichesList (vue Gestion), sans aucune
// action puisque cet utilisateur ne peut rien modifier ici.
export default function KitchenDashboard({
  chefsCount,
  coursesCount,
  unassignedCount,
  equipierPlanningEnabled,
  meals,
  chefs,
  coursesMembers,
  unassigned,
  eventParticipantsCount,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`${CARD} flex flex-row items-center gap-3 p-4`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <UsersIcon />
          </span>
          <div>
            <div className="font-serif text-2xl font-semibold leading-none tabular-nums">
              {chefsCount}
            </div>
            <div className="text-xs opacity-60 mt-1">Chefs</div>
          </div>
        </div>
        <div className={`${CARD} flex flex-row items-center gap-3 p-4`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShoppingCartIcon />
          </span>
          <div>
            <div className="font-serif text-2xl font-semibold leading-none tabular-nums">
              {coursesCount}
            </div>
            <div className="text-xs opacity-60 mt-1">Équipe courses</div>
          </div>
        </div>
        <div className={`${CARD} flex flex-row items-center gap-3 p-4`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <InfoCircleIcon />
          </span>
          <div>
            <div className="font-serif text-2xl font-semibold leading-none tabular-nums">
              {unassignedCount}
            </div>
            <div className="text-xs opacity-60 mt-1">Sans affectation</div>
          </div>
        </div>
      </div>

      <div className={`${CARD} flex flex-row flex-wrap items-center gap-2 p-3`}>
        <span
          className={`badge gap-1 ${equipierPlanningEnabled ? "badge-success" : "badge-warning"}`}
        >
          {equipierPlanningEnabled ? <EyeIcon /> : <EyeOffIcon />}
          {equipierPlanningEnabled ? "Publié" : "Non publié"}
        </span>
        <span className="text-xs opacity-70">
          {equipierPlanningEnabled
            ? "Le planning cuisine est visible par les équipiers."
            : "Le planning cuisine n'est pas encore visible par les équipiers."}
        </span>
      </div>

      <div>
        <SectionEyebrow icon={<UsersIcon />}>Équipe cuisine</SectionEyebrow>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className={CARD}>
            <div className="card-body p-3">
              <h4 className="font-semibold text-sm mb-2">Chefs</h4>
              {chefs.length === 0 ? (
                <p className="text-xs opacity-60">Aucun chef pour l'instant.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {chefs.map((c) => (
                    <span key={c.id} className="badge badge-ghost gap-1.5 py-3">
                      <PersonAvatar name={displayedName(c)} />
                      {displayedName(c)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={CARD}>
            <div className="card-body p-3">
              <h4 className="font-semibold text-sm mb-2">Équipe courses</h4>
              {coursesMembers.length === 0 ? (
                <p className="text-xs opacity-60">Aucun membre pour l'instant.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {coursesMembers.map((p) => (
                    <span key={p.id} className="badge badge-ghost gap-1.5 py-3">
                      <PersonAvatar name={displayedName(p)} />
                      {displayedName(p)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={CARD}>
            <div className="card-body p-3">
              <h4 className="font-semibold text-sm mb-2">Sans affectation</h4>
              {unassigned.length === 0 ? (
                <p className="text-xs opacity-60">Tout le monde a un rôle cuisine.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-[11.5rem] overflow-y-auto pr-1">
                  {unassigned.map((p) => (
                    <span key={p.id} className="badge badge-ghost gap-1.5 py-3">
                      <PersonAvatar name={displayedName(p)} />
                      {displayedName(p)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionEyebrow icon={<UtensilsIcon />}>Repas</SectionEyebrow>
        {meals.length === 0 ? (
          <EmptyState icon={<span>🍽️</span>} title="Aucun repas planifié pour l'instant" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {meals.map((meal) => {
              const needsChef = !meal.chef;
              const isComplete = meal.remainingSeats === 0;
              const borderClass = needsChef
                ? "border-l-4 border-l-warning"
                : isComplete
                  ? "border-l-4 border-l-success"
                  : "border-l-4 border-l-info";
              const filled = meal.maxAssistants - meal.remainingSeats;
              return (
                <div
                  key={meal.id}
                  className={`card bg-base-200 border border-base-300 shadow-[0_1px_2px_rgba(0,0,0,.3),0_10px_24px_-12px_rgba(0,0,0,.5)] ${borderClass}`}
                >
                  <div className="card-body p-3 space-y-2">
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-wider font-bold opacity-50">
                        {whenLabel(meal)}
                      </p>
                      <p className="font-serif text-base font-semibold leading-tight mt-0.5">
                        {meal.name || whenLabel(meal)}
                      </p>
                    </div>

                    <div className="h-px bg-base-300" />

                    <div className="flex items-center gap-2">
                      <span className="text-[0.68rem] uppercase tracking-wide font-bold opacity-50 w-14 shrink-0">
                        Chef
                      </span>
                      {meal.chef ? (
                        <span className="flex items-center gap-2 text-sm">
                          <PersonAvatar name={displayedName(meal.chef)} />
                          {displayedName(meal.chef)}
                        </span>
                      ) : (
                        <span className="text-sm italic opacity-50">Sans chef</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[0.68rem] uppercase tracking-wide font-bold opacity-50 w-14 shrink-0">
                        Places
                      </span>
                      <div className="flex-1">
                        <div className="h-1.5 w-full rounded-full bg-base-300 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isComplete ? "bg-success" : "bg-info"}`}
                            style={{
                              width: `${
                                meal.maxAssistants > 0
                                  ? Math.min(100, (filled / meal.maxAssistants) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="text-xs opacity-50 mt-1 tabular-nums">
                          {filled} / {meal.maxAssistants} pourvues
                        </div>
                      </div>
                    </div>

                    {meal.vegeCount !== undefined && meal.carneCount !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-[0.68rem] uppercase tracking-wide font-bold opacity-50 w-14 shrink-0">
                          Repas
                        </span>
                        <span className="badge badge-ghost badge-sm gap-1">
                          🌱 {meal.vegeCount}
                        </span>
                        <span className="badge badge-ghost badge-sm gap-1">
                          🥩 {meal.carneCount}
                        </span>
                        {eventParticipantsCount !== undefined &&
                          meal.vegeCount + meal.carneCount !== eventParticipantsCount && (
                            <span
                              className="badge badge-warning badge-sm gap-1"
                              title={`Attendu ${eventParticipantsCount} participants`}
                            >
                              <AlertTriangleIcon className="w-3 h-3" />
                            </span>
                          )}
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <span className="text-[0.68rem] uppercase tracking-wide font-bold opacity-50 w-14 shrink-0 mt-0.5">
                        Équipiers
                      </span>
                      {meal.assistants.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {meal.assistants.map((a) => (
                            <span key={a.id} className="badge badge-ghost badge-sm">
                              {displayedName(a)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="badge badge-ghost badge-sm border-dashed opacity-60">
                          Aucun équipier
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
