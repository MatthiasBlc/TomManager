import { useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import ResponsiveModal from "../common/ResponsiveModal";
import { getErrorMessage } from "../../config/apiErrors";
import { SERVICE_OPTIONS } from "./units";

interface SlotFormValues {
  date: string;
  service: "LUNCH" | "DINNER";
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: string;
  eventStartDate?: string;
  eventEndDate?: string;
}

// Creation manuelle hors-grille (Evolutions.md point 1) : le responsable ne cree
// qu'un creneau orphelin (jour + service), au meme titre qu'un creneau de la grille
// generee. Le nom/les horaires sont derives par le backend ; le chef reclame ensuite
// ce creneau et l'edite (nom, ingredients, ustensiles) comme n'importe quel autre.
export default function CreateMealSlotModal({
  open,
  onClose,
  onSaved,
  eventId,
  eventStartDate,
  eventEndDate,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SlotFormValues>({
    defaultValues: { date: eventStartDate, service: "DINNER" },
  });

  useEffect(() => {
    if (open) reset({ date: eventStartDate, service: "DINNER" });
  }, [open, eventStartDate, reset]);

  const onSubmit = async (data: SlotFormValues) => {
    try {
      await api.post(`/api/events/${eventId}/kitchen/meals`, data);
      toast.success("Créneau créé");
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la création du créneau"));
    }
  };

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Créer un créneau manuellement">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4 md:p-0 md:mt-4">
        <div className="form-control">
          <label className="label" htmlFor="cms-date">
            <span className="label-text">Jour</span>
          </label>
          <input
            id="cms-date"
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

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting && <span className="loading loading-spinner loading-xs" />}
            Créer
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
