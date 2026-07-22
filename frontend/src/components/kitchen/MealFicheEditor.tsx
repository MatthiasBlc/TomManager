import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useConfirm } from "../../contexts/ConfirmContext";
import { getErrorMessage } from "../../config/apiErrors";
import { useDebouncedSave, type SaveStatus } from "../../hooks/useDebouncedSave";
import NumberStepper from "../common/NumberStepper";
import IngredientListInput, { type IngredientRow } from "./IngredientListInput";
import UtensilListInput from "./UtensilListInput";
import { SERVICE_OPTIONS, serviceLabel } from "./units";
import type { MealFiche } from "./MealFichesList";

interface Props {
  eventId: string;
  meal: MealFiche;
  // Champs structurants (service, jour, horaires, capacite) reserves au manager,
  // cf spec CookV1 5 : le chef n'edite que nom/ingredients/ustensiles de son creneau.
  canEditSchedule: boolean;
  onChanged: () => void;
  eventStartDate?: string;
  eventEndDate?: string;
}

function toDatePart(iso: string) {
  return iso.slice(0, 10);
}
function toTimePart(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
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
// "Enregistrer". Reutilise a la fois dans "Mon repas" (chef, canEditSchedule=false)
// et dans Gestion (manager, canEditSchedule=true).
export default function MealFicheEditor({
  eventId,
  meal,
  canEditSchedule,
  onChanged,
  eventStartDate,
  eventEndDate,
}: Props) {
  const confirmDialog = useConfirm();
  const [pendingDelete, setPendingDelete] = useState(false);

  const [name, setName] = useState(meal.name);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(toIngredientRows(meal.ingredients));
  const [utensils, setUtensils] = useState<string[]>((meal.utensils ?? []).map((u) => u.name));
  const [service, setService] = useState<"LUNCH" | "DINNER">(meal.service);
  const [date, setDate] = useState(toDatePart(meal.startDateTime));
  const [startTime, setStartTime] = useState(toTimePart(meal.startDateTime));
  const [endTime, setEndTime] = useState(toTimePart(meal.endDateTime));
  const [maxAssistants, setMaxAssistants] = useState(meal.maxAssistants);

  // Reinitialise les champs uniquement quand on change de repas (pas a chaque
  // refetch du meme repas) : ne jamais ecraser une saisie en cours.
  useEffect(() => {
    setName(meal.name);
    setIngredients(toIngredientRows(meal.ingredients));
    setUtensils((meal.utensils ?? []).map((u) => u.name));
    setService(meal.service);
    setDate(toDatePart(meal.startDateTime));
    setStartTime(toTimePart(meal.startDateTime));
    setEndTime(toTimePart(meal.endDateTime));
    setMaxAssistants(meal.maxAssistants);
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
  const serviceStatus = useDebouncedSave(service, (v) => patchMeal({ service: v }), 0);
  const schedule = useMemo(() => ({ date, startTime, endTime }), [date, startTime, endTime]);
  const scheduleStatus = useDebouncedSave(schedule, (v) =>
    patchMeal({
      startDateTime: new Date(`${v.date}T${v.startTime}`).toISOString(),
      endDateTime: new Date(`${v.date}T${v.endTime}`).toISOString(),
    })
  );
  const capacityStatus = useDebouncedSave(maxAssistants, (v) => patchMeal({ maxAssistants: v }), 0);

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

        {canEditSchedule ? (
          <div className="flex flex-wrap gap-3 items-end">
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text">Service</span>
                <FieldStatus status={serviceStatus} />
              </label>
              <div className="flex gap-2">
                {SERVICE_OPTIONS.map((s) => (
                  <label key={s.value} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="radio"
                      className="radio radio-sm radio-primary"
                      checked={service === s.value}
                      onChange={() => setService(s.value)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-control">
              <label className="label py-1" htmlFor={`mfe-date-${meal.id}`}>
                <span className="label-text">Jour</span>
                <FieldStatus status={scheduleStatus} />
              </label>
              <input
                id={`mfe-date-${meal.id}`}
                type="date"
                className="input input-bordered input-sm"
                min={eventStartDate}
                max={eventEndDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label py-1" htmlFor={`mfe-start-${meal.id}`}>
                <span className="label-text">Début</span>
              </label>
              <input
                id={`mfe-start-${meal.id}`}
                type="time"
                className="input input-bordered input-sm"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label py-1" htmlFor={`mfe-end-${meal.id}`}>
                <span className="label-text">Fin</span>
              </label>
              <input
                id={`mfe-end-${meal.id}`}
                type="time"
                className="input input-bordered input-sm"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text">Capacité</span>
                <FieldStatus status={capacityStatus} />
              </label>
              <NumberStepper value={maxAssistants} min={0} max={99} onChange={setMaxAssistants} />
            </div>
          </div>
        ) : (
          <p className="text-xs opacity-60">
            {serviceLabel(meal.service)} · {formatDateTime(meal.startDateTime)} →{" "}
            {formatDateTime(meal.endDateTime)} · {meal.assistants.length}/{meal.maxAssistants}{" "}
            équipier(s)
          </p>
        )}

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
