import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import ResponsiveModal from "../common/ResponsiveModal";
import { useConfirm } from "../../contexts/ConfirmContext";
import { getErrorMessage } from "../../config/apiErrors";
import IngredientListInput, { type IngredientRow } from "./IngredientListInput";
import UtensilListInput from "./UtensilListInput";
import { SERVICE_OPTIONS } from "./units";

interface MealFormValues {
  name: string;
  service: "LUNCH" | "DINNER";
  date: string;
  startTime: string;
  endTime: string;
}

export interface MealFormMeal {
  id: string;
  name: string;
  service: "LUNCH" | "DINNER";
  startDateTime: string;
  endDateTime: string;
  ingredients?: { name: string; quantity: number; unit: string }[];
  utensils?: { name: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: string;
  meal?: MealFormMeal | null;
  eventStartDate?: string;
  eventEndDate?: string;
}

function toDatePart(iso: string) {
  return iso.slice(0, 10);
}
function toTimePart(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

export default function MealFormModal({
  open,
  onClose,
  onSaved,
  eventId,
  meal,
  eventStartDate,
  eventEndDate,
}: Props) {
  const confirmDialog = useConfirm();
  const isEdit = !!meal;
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [utensils, setUtensils] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<MealFormValues>({
    defaultValues: { service: "DINNER" },
  });

  useEffect(() => {
    if (!open) return;
    if (meal) {
      reset({
        name: meal.name,
        service: meal.service,
        date: toDatePart(meal.startDateTime),
        startTime: toTimePart(meal.startDateTime),
        endTime: toTimePart(meal.endDateTime),
      });
      setIngredients(
        (meal.ingredients ?? []).map((i) => ({
          name: i.name,
          quantity: Number(i.quantity),
          unit: i.unit as IngredientRow["unit"],
        }))
      );
      setUtensils((meal.utensils ?? []).map((u) => u.name));
    } else {
      reset({ name: "", service: "DINNER", date: eventStartDate, startTime: "", endTime: "" });
      setIngredients([]);
      setUtensils([]);
    }
  }, [open, meal, reset, eventStartDate]);

  const hasUnsavedChanges = isDirty;

  const handleClose = async () => {
    if (hasUnsavedChanges) {
      const ok = await confirmDialog({
        title: "Abandonner les modifications ?",
        message: "Les informations saisies seront perdues.",
        confirmLabel: "Abandonner",
        cancelLabel: "Continuer la saisie",
        variant: "warning",
      });
      if (!ok) return;
    }
    onClose();
  };

  const onSubmit = async (data: MealFormValues) => {
    const startDateTime = new Date(`${data.date}T${data.startTime}`);
    const endDateTime = new Date(`${data.date}T${data.endTime}`);

    const payload = {
      name: data.name,
      service: data.service,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity), unit: i.unit })),
      utensils: utensils.map((name) => ({ name })),
    };

    try {
      if (isEdit && meal) {
        await api.patch(`/api/events/${eventId}/kitchen/meals/${meal.id}`, payload);
        toast.success("Fiche repas mise à jour");
      } else {
        await api.post(`/api/events/${eventId}/kitchen/meals`, payload);
        toast.success("Fiche repas créée");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'enregistrement de la fiche repas"));
    }
  };

  return (
    <ResponsiveModal open={open} onClose={handleClose} title={isEdit ? "Modifier le repas" : "Créer mon repas"}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4 md:p-0 md:mt-4">
        <div className="form-control">
          <label className="label" htmlFor="mf-name">
            <span className="label-text">Nom du repas</span>
          </label>
          <input
            id="mf-name"
            type="text"
            className="input input-bordered w-full"
            {...register("name", {
              required: "Le nom est requis",
              maxLength: { value: 150, message: "Max 150 caractères" },
            })}
          />
          {errors.name && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.name.message}</span>
            </label>
          )}
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Service</span>
          </label>
          <div className="flex gap-2">
            {SERVICE_OPTIONS.map((s) => (
              <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  className="radio radio-primary"
                  value={s.value}
                  {...register("service")}
                />
                <span className="text-sm">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="form-control flex-1 min-w-[150px]">
            <label className="label" htmlFor="mf-date">
              <span className="label-text">Date</span>
            </label>
            <input
              id="mf-date"
              type="date"
              className="input input-bordered w-full"
              min={eventStartDate}
              max={eventEndDate}
              {...register("date", { required: "Requis" })}
            />
            {errors.date && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.date.message}</span>
              </label>
            )}
          </div>
          <div className="form-control flex-1 min-w-[110px]">
            <label className="label" htmlFor="mf-start">
              <span className="label-text">Début</span>
            </label>
            <input
              id="mf-start"
              type="time"
              className="input input-bordered w-full"
              {...register("startTime", { required: "Requis" })}
            />
            {errors.startTime && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.startTime.message}</span>
              </label>
            )}
          </div>
          <div className="form-control flex-1 min-w-[110px]">
            <label className="label" htmlFor="mf-end">
              <span className="label-text">Fin</span>
            </label>
            <input
              id="mf-end"
              type="time"
              className="input input-bordered w-full"
              {...register("endTime", { required: "Requis" })}
            />
            {errors.endTime && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.endTime.message}</span>
              </label>
            )}
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Ingrédients</span>
          </label>
          <IngredientListInput value={ingredients} onChange={setIngredients} />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Ustensiles spécifiques</span>
          </label>
          <UtensilListInput value={utensils} onChange={setUtensils} />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn" onClick={handleClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting && <span className="loading loading-spinner loading-xs" />}
            {isEdit ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
