import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { getErrorMessage } from "../../config/apiErrors";
import EmptyState from "../common/EmptyState";
import NumberStepper from "../common/NumberStepper";
import { slotLabel } from "./units";
import MealFicheDetailModal from "./MealFicheDetailModal";

export interface MealFiche {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  endDateTime: string;
  maxAssistants: number;
  chef: { id: string; username: string; displayName?: string | null } | null;
  assistants: { id: string; username: string; displayName?: string | null }[];
  remainingSeats: number;
  ingredients?: { name: string; quantity: number; unit: string }[];
  utensils?: { name: string }[];
}

interface Person {
  id: string;
  username: string;
  displayName?: string | null;
}

interface ChefEntry extends Person {
  source: "ROLE" | "MANUAL";
}

interface Props {
  eventId: string;
  meals: MealFiche[];
  chefs: ChefEntry[];
  unassigned: Person[];
  capacitySummary?: { allocated: number; poolTotal: number };
  onChanged: () => void;
}

const displayedName = (u: Person) => u.displayName ?? u.username;

// Liste des fiches repas, section Gestion (Admin Chef, spec CookV1 5) : creneau non
// editable/non supprimable, chef/capacite/equipiers actionnables directement sur la
// ligne. Le detail (nom du plat, ingredients, ustensiles) s'edite dans la modale
// "details" -> "modifier" -> "valider" (MealFicheDetailModal).
export default function MealFichesList({
  eventId,
  meals,
  chefs,
  unassigned,
  capacitySummary,
  onChanged,
}: Props) {
  const [detailMeal, setDetailMeal] = useState<MealFiche | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [chefChoices, setChefChoices] = useState<Record<string, string>>({});
  const [equipierChoices, setEquipierChoices] = useState<Record<string, string>>({});

  if (meals.length === 0) {
    return (
      <EmptyState
        icon={<span>🍽️</span>}
        title="Aucune fiche repas pour l'instant"
        description="Génère le planning pour commencer."
      />
    );
  }

  // Chefs du roster pas encore sur un creneau (memes donnees que l'ancienne carte
  // "Repas orphelins", repliees dans chaque ligne pour eviter la duplication).
  const assignedChefIds = new Set(meals.filter((m) => m.chef).map((m) => m.chef!.id));
  const eligibleChefs = chefs.filter((c) => !assignedChefIds.has(c.id));
  const poolRemaining = capacitySummary
    ? Math.max(0, capacitySummary.poolTotal - capacitySummary.allocated)
    : undefined;

  const handleAssignChef = async (meal: MealFiche) => {
    const chefId = chefChoices[meal.id];
    if (!chefId) return;
    setPendingAction(`chef:${meal.id}`);
    try {
      await api.patch(`/api/events/${eventId}/kitchen/meals/${meal.id}`, { chefUserId: chefId });
      toast.success("Chef assigné");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'assignation du chef"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleCapacityChange = async (meal: MealFiche, value: number) => {
    setPendingAction(`capacity:${meal.id}`);
    try {
      await api.patch(`/api/events/${eventId}/kitchen/meals/${meal.id}`, { maxAssistants: value });
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la mise à jour de la capacité"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleAddAssistant = async (meal: MealFiche) => {
    const userId = equipierChoices[meal.id];
    if (!userId) return;
    setPendingAction(`add-assistant:${meal.id}`);
    try {
      await api.post(`/api/events/${eventId}/kitchen/meals/${meal.id}/assistants/${userId}`);
      toast.success("Équipier ajouté");
      setEquipierChoices((prev) => ({ ...prev, [meal.id]: "" }));
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'ajout de l'équipier"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemoveAssistant = async (meal: MealFiche, userId: string) => {
    setPendingAction(`remove-assistant:${meal.id}:${userId}`);
    try {
      await api.delete(`/api/events/${eventId}/kitchen/meals/${meal.id}/assistants/${userId}`);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec du retrait de l'équipier"));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {meals.map((meal) => {
          const capacityMax =
            poolRemaining !== undefined ? meal.maxAssistants + poolRemaining : undefined;
          return (
            <div
              key={meal.id}
              className="card bg-base-200 shadow-none cursor-pointer hover:bg-base-300 transition-colors"
              onClick={() => setDetailMeal(meal)}
            >
              <div className="card-body p-3 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm capitalize">{slotLabel(meal)}</p>
                    {meal.name && <p className="text-xs opacity-70">{meal.name}</p>}
                  </div>
                  <span
                    className={`badge badge-sm shrink-0 ${
                      meal.remainingSeats > 0 ? "badge-ghost" : "badge-neutral"
                    }`}
                  >
                    {meal.remainingSeats > 0 ? "places libres" : "complet"}
                  </span>
                </div>

                <div
                  className="flex items-center gap-2 flex-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs opacity-60 w-16 shrink-0">Chef</span>
                  {meal.chef ? (
                    <span className="text-sm">{displayedName(meal.chef)}</span>
                  ) : (
                    <div className="flex gap-2 flex-1 min-w-[200px]">
                      <select
                        className="select select-bordered select-xs flex-1"
                        value={chefChoices[meal.id] ?? ""}
                        onChange={(e) =>
                          setChefChoices((prev) => ({ ...prev, [meal.id]: e.target.value }))
                        }
                        disabled={eligibleChefs.length === 0}
                      >
                        <option value="">Choisir un chef...</option>
                        {eligibleChefs.map((c) => (
                          <option key={c.id} value={c.id}>
                            {displayedName(c)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-xs"
                        disabled={!chefChoices[meal.id] || !!pendingAction}
                        onClick={() => handleAssignChef(meal)}
                      >
                        Assigner
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs opacity-60 w-16 shrink-0">Capacité</span>
                  <span className="text-sm">
                    {meal.assistants.length}/{meal.maxAssistants}
                  </span>
                  <NumberStepper
                    value={meal.maxAssistants}
                    min={meal.assistants.length}
                    max={capacityMax}
                    onChange={(v) => handleCapacityChange(meal, v)}
                  />
                </div>

                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs opacity-60">Équipiers</span>
                  {meal.assistants.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {meal.assistants.map((a) => (
                        <span key={a.id} className="badge badge-outline gap-1">
                          {displayedName(a)}
                          <button
                            type="button"
                            className="text-error"
                            disabled={!!pendingAction}
                            onClick={() => handleRemoveAssistant(meal, a.id)}
                            aria-label={`Retirer ${displayedName(a)}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {meal.remainingSeats > 0 && (
                    <div className="flex gap-2">
                      <select
                        className="select select-bordered select-xs flex-1"
                        value={equipierChoices[meal.id] ?? ""}
                        onChange={(e) =>
                          setEquipierChoices((prev) => ({ ...prev, [meal.id]: e.target.value }))
                        }
                        disabled={unassigned.length === 0}
                      >
                        <option value="">Choisir un équipier...</option>
                        {unassigned.map((p) => (
                          <option key={p.id} value={p.id}>
                            {displayedName(p)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-xs"
                        disabled={!equipierChoices[meal.id] || !!pendingAction}
                        onClick={() => handleAddAssistant(meal)}
                      >
                        Ajouter
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <MealFicheDetailModal
        eventId={eventId}
        meal={detailMeal}
        onClose={() => setDetailMeal(null)}
        onChanged={onChanged}
      />
    </>
  );
}
