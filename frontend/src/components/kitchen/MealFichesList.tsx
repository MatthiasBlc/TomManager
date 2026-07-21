import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useConfirm } from "../../contexts/ConfirmContext";
import EmptyState from "../common/EmptyState";
import NumberStepper from "../common/NumberStepper";
import { getErrorMessage } from "../../config/apiErrors";
import MealFormModal, { type MealFormMeal } from "./MealFormModal";
import { serviceLabel, unitLabel } from "./units";

export interface MealFiche extends MealFormMeal {
  maxAssistants: number;
  chef: { id: string; username: string; displayName?: string | null } | null;
  assistants: { id: string; username: string; displayName?: string | null }[];
  remainingSeats: number;
}

interface Props {
  eventId: string;
  meals: MealFiche[];
  currentUserId?: string;
  isKitchenManager: boolean;
  onChanged: () => void;
  eventStartDate?: string;
  eventEndDate?: string;
}

const displayedName = (u: { username: string; displayName?: string | null }) =>
  u.displayName ?? u.username;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function MealFichesList({
  eventId,
  meals,
  currentUserId,
  isKitchenManager,
  onChanged,
  eventStartDate,
  eventEndDate,
}: Props) {
  const confirmDialog = useConfirm();
  const [editTarget, setEditTarget] = useState<MealFiche | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const canEdit = (meal: MealFiche) => meal.chef?.id === currentUserId || isKitchenManager;

  const handleDelete = async (meal: MealFiche) => {
    const ok = await confirmDialog({
      title: "Supprimer le repas",
      message:
        meal.assistants.length > 0
          ? `${meal.assistants.length} équipier(s) inscrit(s) perdront leur place. Supprimer ce repas ?`
          : "Supprimer ce repas ? Cette action est irréversible.",
      confirmLabel: "Supprimer",
      variant: "danger",
    });
    if (!ok) return;
    setPendingAction(`delete:${meal.id}`);
    try {
      await api.delete(`/api/events/${eventId}/kitchen/meals/${meal.id}`);
      toast.success("Repas supprimé");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la suppression du repas"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleMaxAssistantsChange = async (meal: MealFiche, value: number) => {
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

  if (meals.length === 0) {
    return (
      <EmptyState
        icon={<span>🍽️</span>}
        title="Aucune fiche repas pour l'instant"
        description="Les chefs peuvent créer leur repas depuis cet onglet."
      />
    );
  }

  return (
    <div className="space-y-3">
      {meals.map((meal) => (
        <div key={meal.id} className="card bg-base-200 shadow-none">
          <div className="card-body p-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  {meal.name}
                  <span className="badge badge-outline badge-sm">{serviceLabel(meal.service)}</span>
                  {!meal.chef && <span className="badge badge-warning badge-sm">sans chef</span>}
                </h4>
                <p className="text-xs opacity-70 mt-0.5">
                  {meal.chef ? displayedName(meal.chef) : "Orphelin"} ·{" "}
                  {formatDateTime(meal.startDateTime)} → {formatDateTime(meal.endDateTime)}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {canEdit(meal) && (
                  <button className="btn btn-ghost btn-xs" onClick={() => setEditTarget(meal)}>
                    Modifier
                  </button>
                )}
                {canEdit(meal) && (
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    disabled={!!pendingAction}
                    onClick={() => handleDelete(meal)}
                  >
                    {pendingAction === `delete:${meal.id}` && (
                      <span className="loading loading-spinner loading-xs" />
                    )}
                    Supprimer
                  </button>
                )}
              </div>
            </div>

            {meal.ingredients && meal.ingredients.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium opacity-70 mb-1">Ingrédients</p>
                <ul className="text-xs opacity-80 flex flex-wrap gap-x-3 gap-y-0.5">
                  {meal.ingredients.map((ing, i) => (
                    <li key={i}>
                      {ing.name} — {ing.quantity} {unitLabel(ing.unit)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {meal.utensils && meal.utensils.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {meal.utensils.map((u, i) => (
                  <span key={i} className="badge badge-ghost badge-sm">
                    {u.name}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center gap-2 text-xs opacity-70">
              <span>
                {meal.assistants.length}/{meal.maxAssistants} équipier(s)
              </span>
              {isKitchenManager && (
                <NumberStepper
                  value={meal.maxAssistants}
                  min={0}
                  max={99}
                  disabled={pendingAction === `capacity:${meal.id}`}
                  onChange={(v) => handleMaxAssistantsChange(meal, v)}
                />
              )}
            </div>
          </div>
        </div>
      ))}

      <MealFormModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        onSaved={onChanged}
        eventId={eventId}
        meal={editTarget}
        eventStartDate={eventStartDate}
        eventEndDate={eventEndDate}
      />
    </div>
  );
}
