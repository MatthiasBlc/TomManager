import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useConfirm } from "../../contexts/ConfirmContext";
import { getErrorMessage } from "../../config/apiErrors";
import { useDebouncedSave, type SaveStatus } from "../../hooks/useDebouncedSave";
import IngredientListInput, { type IngredientRow } from "./IngredientListInput";
import UtensilListInput from "./UtensilListInput";
import { serviceLabel } from "./units";
import { formatParisDateTime } from "../../utils/dateTime";
import type { MealFiche } from "./MealFichesList";

interface Props {
  eventId: string;
  meal: MealFiche;
  onChanged: () => void;
}

const formatDateTime = (iso: string) =>
  formatParisDateTime(iso, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function FieldStatus({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return <span className="loading loading-spinner loading-xs opacity-60 ml-1" />;
  }
  if (status === "saved") {
    return (
      <span className="text-success text-xs ml-1" aria-label="Enregistré">
        ✓
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-error text-xs ml-1" aria-label="Échec de l'enregistrement">
        ⚠
      </span>
    );
  }
  return null;
}

const toIngredientRows = (ingredients: MealFiche["ingredients"]): IngredientRow[] =>
  (ingredients ?? []).map((i) => ({
    name: i.name,
    quantity: Number(i.quantity),
    unit: i.unit as IngredientRow["unit"],
  }));

// Fiche repas editable "a la volee" (Evolutions.md point 1) : chaque champ
// s'auto-sauvegarde individuellement via PATCH partiel, jamais de bouton
// "Enregistrer". Utilise uniquement dans "Mon repas" (le chef n'edite que
// nom/ingredients/ustensiles de son propre creneau) ; la Gestion (manager) utilise
// desormais la liste de fiches dediee (MealFichesList) pour chef/capacite/equipiers.
export default function MealFicheEditor({ eventId, meal, onChanged }: Props) {
  const confirmDialog = useConfirm();
  const [pendingDelete, setPendingDelete] = useState(false);

  const [name, setName] = useState(meal.name);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    toIngredientRows(meal.ingredients)
  );
  const [utensils, setUtensils] = useState<string[]>((meal.utensils ?? []).map((u) => u.name));

  // Reinitialise les champs uniquement quand on change de repas (pas a chaque
  // refetch du meme repas) : ne jamais ecraser une saisie en cours.
  useEffect(() => {
    setName(meal.name);
    setIngredients(toIngredientRows(meal.ingredients));
    setUtensils((meal.utensils ?? []).map((u) => u.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal.id]);

  const patchMeal = async (payload: Record<string, unknown>) => {
    try {
      await api.patch(`/api/events/${eventId}/kitchen/meals/${meal.id}`, payload);
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'enregistrement"));
      throw err;
    }
  };

  const nameStatus = useDebouncedSave(name, (v) => patchMeal({ name: v }));
  const ingredientsStatus = useDebouncedSave(ingredients, (v) =>
    patchMeal({
      ingredients: v
        .filter((i) => i.name.trim())
        .map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity), unit: i.unit })),
    })
  );
  const utensilsStatus = useDebouncedSave(utensils, (v) =>
    patchMeal({ utensils: v.map((n) => ({ name: n })) })
  );

  const handleDelete = async () => {
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
    setPendingDelete(true);
    try {
      await api.delete(`/api/events/${eventId}/kitchen/meals/${meal.id}`);
      toast.success("Repas supprimé");
      onChanged();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la suppression du repas"));
    } finally {
      setPendingDelete(false);
    }
  };

  return (
    <div className="card bg-base-200 shadow-none">
      <div className="card-body p-3 space-y-3">
        <p className="text-xs opacity-60">
          {serviceLabel(meal.service)} · {formatDateTime(meal.startDateTime)} →{" "}
          {formatDateTime(meal.endDateTime)} · {meal.assistants.length}/{meal.maxAssistants}{" "}
          équipier(s)
        </p>

        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="form-control flex-1 min-w-[200px]">
            <label className="label py-1" htmlFor={`mfe-name-${meal.id}`}>
              <span className="label-text">Nom du repas</span>
              <FieldStatus status={nameStatus} />
            </label>
            <input
              id={`mfe-name-${meal.id}`}
              type="text"
              className="input input-bordered input-sm w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            className="btn btn-ghost btn-xs text-error"
            disabled={pendingDelete}
            onClick={handleDelete}
          >
            {pendingDelete && <span className="loading loading-spinner loading-xs" />}
            Supprimer
          </button>
        </div>

        <div className="form-control">
          <label className="label py-1">
            <span className="label-text">Ingrédients</span>
            <FieldStatus status={ingredientsStatus} />
          </label>
          <IngredientListInput value={ingredients} onChange={setIngredients} />
        </div>

        <div className="form-control">
          <label className="label py-1">
            <span className="label-text">Ustensiles spécifiques</span>
            <FieldStatus status={utensilsStatus} />
          </label>
          <UtensilListInput value={utensils} onChange={setUtensils} />
        </div>
      </div>
    </div>
  );
}
