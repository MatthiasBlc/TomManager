import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import ResponsiveModal from "../common/ResponsiveModal";
import { useAuth } from "../../contexts/AuthContext";

interface CreateEventForm {
  name: string;
  startDateTime: string;
  endDateTime: string;
  discordRoleId: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateEventModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventForm>();

  const onSubmit = async (data: CreateEventForm) => {
    try {
      await api.post("/api/events", {
        name: data.name,
        startDateTime: new Date(data.startDateTime).toISOString(),
        endDateTime: new Date(data.endDateTime).toISOString(),
        discordRoleId: data.discordRoleId?.trim() || null,
      });
      toast.success("Evenement cree !");
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Echec de la creation de l'evenement";
      toast.error(message);
    }
  };

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Creer un evenement">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 md:p-0 md:mt-4">
        <div className="form-control">
          <label className="label" htmlFor="ce-name">
            <span className="label-text">Nom</span>
          </label>
          <input
            id="ce-name"
            type="text"
            className="input input-bordered w-full"
            {...register("name", {
              required: "Le nom est obligatoire",
              maxLength: { value: 100, message: "100 caracteres maximum" },
            })}
          />
          {errors.name && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.name.message}</span>
            </label>
          )}
        </div>
        <div className="form-control">
          <label className="label" htmlFor="ce-start">
            <span className="label-text">Debut</span>
          </label>
          <input
            id="ce-start"
            type="datetime-local"
            className="input input-bordered w-full"
            {...register("startDateTime", {
              required: "La date de debut est obligatoire",
            })}
          />
          {errors.startDateTime && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.startDateTime.message}</span>
            </label>
          )}
        </div>
        <div className="form-control">
          <label className="label" htmlFor="ce-end">
            <span className="label-text">Fin</span>
          </label>
          <input
            id="ce-end"
            type="datetime-local"
            className="input input-bordered w-full"
            {...register("endDateTime", {
              required: "La date de fin est obligatoire",
              validate: (value) =>
                new Date(value) > new Date(getValues("startDateTime")) ||
                "La fin doit etre apres le debut",
            })}
          />
          {errors.endDateTime && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.endDateTime.message}</span>
            </label>
          )}
        </div>
        {user?.role === "ADMIN" && (
          <div className="form-control">
            <label className="label" htmlFor="ce-discord-role">
              <span className="label-text">Discord Role ID</span>
              <span className="label-text-alt opacity-50">optionnel</span>
            </label>
            <input
              id="ce-discord-role"
              type="text"
              className="input input-bordered w-full"
              placeholder="Ex: 1234567890123456789"
              {...register("discordRoleId", {
                pattern: {
                  value: /^(\d{17,20})?$/,
                  message: "Doit etre un Discord Snowflake (17-20 chiffres) ou vide",
                },
              })}
            />
            {errors.discordRoleId && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.discordRoleId.message}</span>
              </label>
            )}
          </div>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting && <span className="loading loading-spinner loading-xs" />}
            Creer
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
