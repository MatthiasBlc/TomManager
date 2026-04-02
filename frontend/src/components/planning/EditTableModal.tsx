import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import TagInput from "./TagInput";
import ResponsiveModal from "../common/ResponsiveModal";

const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1h", value: 60 },
  { label: "1h30", value: 90 },
  { label: "2h", value: 120 },
  { label: "2h30", value: 150 },
  { label: "3h", value: 180 },
  { label: "4h", value: 240 },
  { label: "5h", value: 300 },
  { label: "6h", value: 360 },
];

function snapDuration(ms: number): number {
  const minutes = Math.round(ms / 60000);
  const values = DURATION_OPTIONS.map((o) => o.value);
  return values.reduce((prev, curr) =>
    Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev
  );
}

function toLocalDate(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function toLocalTime(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(11, 16);
}

interface EditTableForm {
  title: string;
  pitch: string;
  triggers: string;
  comments: string;
  maxPlayers: number;
  date: string;
  startTime: string;
  durationMinutes: number;
}

interface TableData {
  id: string;
  title: string;
  pitch: string | null;
  triggers: string | null;
  comments: string | null;
  maxPlayers: number;
  startDateTime: string;
  endDateTime: string;
  tags: { id: string; name: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  eventId: string;
  table: TableData;
}

export default function EditTableModal({ open, onClose, onUpdated, eventId, table }: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditTableForm>();

  useEffect(() => {
    if (open && table) {
      const durationMs =
        new Date(table.endDateTime).getTime() - new Date(table.startDateTime).getTime();
      reset({
        title: table.title,
        pitch: table.pitch || "",
        triggers: table.triggers || "",
        comments: table.comments || "",
        maxPlayers: table.maxPlayers,
        date: toLocalDate(table.startDateTime),
        startTime: toLocalTime(table.startDateTime),
        durationMinutes: snapDuration(durationMs),
      });
      setTags(table.tags.map((t) => t.name));
    }
  }, [open, table, reset]);

  const onSubmit = async (data: EditTableForm) => {
    try {
      const startDateTime = new Date(`${data.date}T${data.startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + Number(data.durationMinutes) * 60000);

      await api.patch(`/api/events/${eventId}/tables/${table.id}`, {
        title: data.title,
        pitch: data.pitch || null,
        triggers: data.triggers || null,
        comments: data.comments || null,
        maxPlayers: Number(data.maxPlayers),
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        tags,
      });
      toast.success("Table mise a jour !");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Echec de la mise a jour";
      toast.error(message);
    }
  };

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Modifier la table">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4 md:p-0 md:mt-4">
        <div className="form-control">
          <label className="label" htmlFor="et-title">
            <span className="label-text">Titre</span>
          </label>
          <input
            id="et-title"
            type="text"
            className="input input-bordered w-full"
            {...register("title", {
              required: "Le titre est requis",
              maxLength: { value: 150, message: "Max 150 caracteres" },
            })}
          />
          {errors.title && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.title.message}</span>
            </label>
          )}
        </div>

        <div className="form-control">
          <label className="label" htmlFor="et-pitch">
            <span className="label-text">Pitch</span>
          </label>
          <textarea
            id="et-pitch"
            className="textarea textarea-bordered w-full"
            rows={3}
            {...register("pitch", {
              maxLength: { value: 2000, message: "Max 2000 caracteres" },
            })}
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="et-triggers">
            <span className="label-text">Triggers</span>
          </label>
          <textarea
            id="et-triggers"
            className="textarea textarea-bordered w-full"
            rows={2}
            {...register("triggers", {
              maxLength: { value: 1000, message: "Max 1000 caracteres" },
            })}
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="et-comments">
            <span className="label-text">Commentaires</span>
          </label>
          <textarea
            id="et-comments"
            className="textarea textarea-bordered w-full"
            rows={2}
            {...register("comments", {
              maxLength: { value: 1000, message: "Max 1000 caracteres" },
            })}
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="et-maxPlayers">
            <span className="label-text">Joueurs max</span>
          </label>
          <input
            id="et-maxPlayers"
            type="number"
            className="input input-bordered w-full"
            inputMode="numeric"
            min={1}
            max={20}
            {...register("maxPlayers", {
              required: "Requis",
              min: { value: 1, message: "Min 1" },
              max: { value: 20, message: "Max 20" },
              valueAsNumber: true,
            })}
          />
          {errors.maxPlayers && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.maxPlayers.message}</span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="form-control sm:col-span-1">
            <label className="label" htmlFor="et-date">
              <span className="label-text">Date</span>
            </label>
            <input
              id="et-date"
              type="date"
              className="input input-bordered w-full"
              {...register("date", { required: "Requis" })}
            />
            {errors.date && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.date.message}</span>
              </label>
            )}
          </div>
          <div className="form-control">
            <label className="label" htmlFor="et-startTime">
              <span className="label-text">Heure de debut</span>
            </label>
            <input
              id="et-startTime"
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
          <div className="form-control">
            <label className="label" htmlFor="et-duration">
              <span className="label-text">Duree</span>
            </label>
            <select
              id="et-duration"
              className="select select-bordered w-full"
              {...register("durationMinutes", { required: "Requis", valueAsNumber: true })}
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Tags</span>
          </label>
          <TagInput value={tags} onChange={setTags} />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
