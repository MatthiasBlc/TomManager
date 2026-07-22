import { type MealSlot } from "./kitchenSlots";
import { serviceLabel } from "../kitchen/units";
import { useAuth } from "../../contexts/AuthContext";
import { formatParisTime } from "../../utils/dateTime";

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

  return (
    <div
      className={`card bg-base-100 border h-full overflow-hidden ${
        meal.currentUserConflict ? "border-error border-2" : "border-warning/40"
      }`}
    >
      <div className="card-body p-4">
        <div className="flex items-start justify-between flex-wrap gap-1">
          <h3 className="card-title text-base truncate">🍽 {meal.name}</h3>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="badge badge-warning badge-sm">{serviceLabel(meal.service)}</span>
            {meal.currentUserConflict && (
              <span className="badge badge-error badge-sm">⚠ Conflit</span>
            )}
            {showChefConflict && (
              <span className="badge badge-error badge-sm">
                ⚠ {meal.conflictingCount} conflit{meal.conflictingCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <p className="text-sm opacity-70">
          {formatParisTime(meal.startDateTime)} - {formatParisTime(meal.endDateTime)}
        </p>

        <p className="text-sm opacity-60 truncate">
          {meal.chef ? `Chef : ${meal.chef.displayName ?? meal.chef.username}` : "Sans chef"}
        </p>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="badge badge-ghost badge-sm">
            {meal.assistants.length}/{meal.maxAssistants} équipiers
          </span>
          {meal.remainingSeats > 0 && (
            <span className="text-xs opacity-70">
              {meal.remainingSeats} place{meal.remainingSeats > 1 ? "s" : ""} restante
              {meal.remainingSeats > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {meal.assistants.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {meal.assistants.map((a) => (
              <span
                key={a.id}
                className="badge badge-outline badge-xs opacity-70 max-w-full truncate"
              >
                {a.displayName ?? a.username}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
