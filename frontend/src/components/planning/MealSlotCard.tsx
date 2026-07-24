import { type MealSlot } from "./kitchenSlots";
import { serviceLabel } from "../kitchen/units";
import { useAuth } from "../../contexts/AuthContext";
import { formatParisTime } from "../../utils/dateTime";
import { CARD } from "../common/ui";
import PersonAvatar from "../common/PersonAvatar";
import { AlertTriangleIcon } from "../common/icons";

interface Props {
  meal: MealSlot;
}

// Carte creneau cuisine dans la vue liste du Planning. Lecture seule : l'inscription
// et le deplacement se font depuis l'onglet Info (board repas). Le conflit est mis en
// surbrillance pour la personne concernee et pour le chef du repas (spec 6).
export default function MealSlotCard({ meal }: Props) {
  const { user } = useAuth();
  const isChef = !!user && meal.chef?.id === user.id;
  // Le chef voit le nombre de personnes en conflit sur son repas, sauf s'il est
  // lui-meme en conflit (dans ce cas c'est sa propre alerte qui prime)
  const showChefConflict = isChef && !meal.currentUserConflict && meal.conflictingCount > 0;

  const conflictBadge = meal.currentUserConflict ? (
    <span className="badge badge-error badge-sm gap-1 shrink-0">
      <AlertTriangleIcon className="w-3 h-3" />
      Conflit
    </span>
  ) : showChefConflict ? (
    <span className="badge badge-error badge-sm gap-1 shrink-0">
      <AlertTriangleIcon className="w-3 h-3" />
      {meal.conflictingCount} conflit{meal.conflictingCount > 1 ? "s" : ""}
    </span>
  ) : null;

  const filled = meal.maxAssistants - meal.remainingSeats;
  const isComplete = meal.remainingSeats === 0 && meal.maxAssistants > 0;
  const fillPct = meal.maxAssistants > 0 ? Math.min(100, (filled / meal.maxAssistants) * 100) : 0;

  return (
    <div
      className={`${CARD} h-full overflow-hidden border-l-4 ${
        conflictBadge ? "border-l-error" : isComplete ? "border-l-success" : "border-l-warning"
      }`}
    >
      <div className="card-body p-3 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-[0.68rem] uppercase tracking-wider font-bold opacity-50">
              {formatParisTime(meal.startDateTime)} - {formatParisTime(meal.endDateTime)}
            </p>
            <p className="font-serif text-base font-semibold leading-tight mt-0.5 truncate">
              {meal.name}
            </p>
          </div>
          <span className="badge badge-warning badge-sm shrink-0">
            {serviceLabel(meal.service)}
          </span>
        </div>

        <div className="h-px bg-base-300" />

        <div className="flex items-center gap-2">
          <span className="text-[0.68rem] uppercase tracking-wide font-bold opacity-50 w-14 shrink-0">
            Chef
          </span>
          {meal.chef ? (
            <span className="flex items-center gap-2 text-sm truncate min-w-0">
              <PersonAvatar name={meal.chef.displayName ?? meal.chef.username} />
              <span className="truncate">{meal.chef.displayName ?? meal.chef.username}</span>
            </span>
          ) : (
            <span className="text-sm italic opacity-50">Sans chef</span>
          )}
          {conflictBadge && <span className="ml-auto">{conflictBadge}</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[0.68rem] uppercase tracking-wide font-bold opacity-50 w-14 shrink-0">
            Équipiers
          </span>
          <div className="flex-1 min-w-0">
            <div className="h-1.5 w-full rounded-full bg-base-300 overflow-hidden">
              <div
                className={`h-full rounded-full ${isComplete ? "bg-success" : "bg-info"}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <div className="text-xs opacity-50 mt-1 tabular-nums truncate">
              {filled} / {meal.maxAssistants} pourvues
            </div>
          </div>
        </div>

        {meal.assistants.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {meal.assistants.map((a) => (
              <span key={a.id} className="badge badge-ghost badge-xs max-w-full truncate">
                {a.displayName ?? a.username}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
