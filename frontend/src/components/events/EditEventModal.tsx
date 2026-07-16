import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import ResponsiveModal from "../common/ResponsiveModal";
import { useAdminRights } from "../../hooks/useAdminRights";
import { useConfirm } from "../../contexts/ConfirmContext";
import { getErrorMessage } from "../../config/apiErrors";

interface EditEventForm {
  name: string;
  startDateTime: string;
  endDateTime: string;
  discordRoleId: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  event: {
    id: string;
    name: string;
    startDateTime: string;
    endDateTime: string;
    discordRoleId?: string | null;
  } | null;
}

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventModal({ open, onClose, onUpdated, event }: Props) {
  const { canManageEvents } = useAdminRights();
  const confirmDialog = useConfirm();
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditEventForm>();
  const [purging, setPurging] = useState(false);
  const busy = isSubmitting || purging;

  // Garde "modifications non enregistrees" (backdrop, Echap, swipe-down, Annuler)
  const handleClose = async () => {
    if (isDirty) {
      const ok = await confirmDialog({
        title: "Abandonner les modifications ?",
        message: "Les modifications non enregistrées seront perdues.",
        confirmLabel: "Abandonner",
        cancelLabel: "Continuer la saisie",
        variant: "warning",
      });
      if (!ok) return;
    }
    onClose();
  };

  useEffect(() => {
    if (event && open) {
      reset({
        name: event.name,
        startDateTime: toLocalDatetime(event.startDateTime),
        endDateTime: toLocalDatetime(event.endDateTime),
        discordRoleId: event.discordRoleId ?? "",
      });
    }
  }, [event, open, reset]);

  const handlePurge = async () => {
    if (!event) return;
    const ok = await confirmDialog({
      title: "Purger l'événement",
      message:
        "Purger cet event ?\n\nCela supprimera définitivement :\n- Toutes les tables de jeu\n- Toutes les participations\n- Tous les jeux\n\nL'event lui-même sera conservé.",
      confirmLabel: "Purger",
      variant: "danger",
    });
    if (!ok) return;
    setPurging(true);
    try {
      await api.post(`/api/events/${event.id}/purge`);
      toast.success("Event purgé !");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la purge"));
    } finally {
      setPurging(false);
    }
  };

  const onSubmit = async (data: EditEventForm) => {
    if (!event) return;
    try {
      await api.patch(`/api/events/${event.id}`, {
        name: data.name,
        startDateTime: new Date(data.startDateTime).toISOString(),
        endDateTime: new Date(data.endDateTime).toISOString(),
        discordRoleId: data.discordRoleId.trim() || null,
      });
      toast.success("Événement mis à jour !");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de la mise à jour de l'événement"));
    }
  };

  if (!event) return null;

  return (
    <ResponsiveModal open={open} onClose={handleClose} title="Modifier l'événement">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 md:p-0 md:mt-4">
        <div className="form-control">
          <label className="label" htmlFor="ee-name">
            <span className="label-text">Nom</span>
          </label>
          <input
            id="ee-name"
            type="text"
            className="input input-bordered w-full"
            {...register("name", {
              required: "Le nom est obligatoire",
              maxLength: { value: 100, message: "100 caractères maximum" },
            })}
          />
          {errors.name && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.name.message}</span>
            </label>
          )}
        </div>
        <div className="form-control">
          <label className="label" htmlFor="ee-start">
            <span className="label-text">Début</span>
          </label>
          <input
            id="ee-start"
            type="datetime-local"
            className="input input-bordered w-full"
            {...register("startDateTime", {
              required: "La date de début est obligatoire",
            })}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="ee-end">
            <span className="label-text">Fin</span>
          </label>
          <input
            id="ee-end"
            type="datetime-local"
            className="input input-bordered w-full"
            {...register("endDateTime", {
              required: "La date de fin est obligatoire",
              validate: (value) =>
                new Date(value) > new Date(getValues("startDateTime")) ||
                "La fin doit être après le début",
            })}
          />
          {errors.endDateTime && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.endDateTime.message}</span>
            </label>
          )}
        </div>
        {canManageEvents && (
          <div className="form-control">
            <label className="label" htmlFor="ee-discord-role">
              <span className="label-text">Discord Role ID</span>
              <span className="label-text-alt opacity-50">optionnel</span>
            </label>
            <input
              id="ee-discord-role"
              type="text"
              className="input input-bordered w-full"
              placeholder="Ex: 1234567890123456789"
              {...register("discordRoleId", {
                pattern: {
                  value: /^(\d{17,20})?$/,
                  message: "Doit être un Discord Snowflake (17-20 chiffres) ou vide",
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
        <div className="flex items-center justify-between pt-2">
          {canManageEvents && (
            <button
              type="button"
              className="btn btn-error btn-outline btn-sm"
              onClick={handlePurge}
              disabled={busy}
            >
              {purging && <span className="loading loading-spinner loading-xs" />}
              Purger l'event
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" className="btn" onClick={handleClose} disabled={busy}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {isSubmitting && <span className="loading loading-spinner loading-xs" />}
              Enregistrer
            </button>
          </div>
        </div>
      </form>
    </ResponsiveModal>
  );
}
