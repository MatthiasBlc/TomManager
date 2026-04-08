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

interface CreateTableForm {
  title: string;
  type: "JDR" | "JDS";
  gmIsPlayer: boolean;
  pitch: string;
  triggers: string;
  comments: string;
  maxPlayers: number;
  date: string;
  startTime: string;
  durationMinutes: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  eventId: string;
  prefilledSlot?: { date: string; startTime: string; durationMinutes: number };
  eventStartDate?: string; // YYYY-MM-DD — pour min/max du date picker
  eventEndDate?: string; // YYYY-MM-DD
}

export default function CreateTableModal({
  open,
  onClose,
  onCreated,
  eventId,
  prefilledSlot,
  eventStartDate,
  eventEndDate,
}: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTableForm>({
    defaultValues: { durationMinutes: 120, type: "JDR", gmIsPlayer: false },
  });

  const tableType = watch("type");
  // Reset gmIsPlayer when switching to JDS
  useEffect(() => {
    if (tableType === "JDS") setValue("gmIsPlayer", false);
  }, [tableType, setValue]);

  // Pre-remplir date/heure depuis une selection sur le calendrier
  useEffect(() => {
    if (open && prefilledSlot) {
      setValue("date", prefilledSlot.date);
      setValue("startTime", prefilledSlot.startTime);
      // Arrondir la duree au multiple de 30 le plus proche dans les options
      const snapped = [30, 60, 90, 120, 150, 180, 240, 300, 360].reduce((prev, cur) =>
        Math.abs(cur - prefilledSlot.durationMinutes) <
        Math.abs(prev - prefilledSlot.durationMinutes)
          ? cur
          : prev
      );
      setValue("durationMinutes", snapped);
    }
  }, [open, prefilledSlot, setValue]);

  const onSubmit = async (data: CreateTableForm) => {
    try {
      const startDateTime = new Date(`${data.date}T${data.startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + Number(data.durationMinutes) * 60000);

      await api.post(`/api/events/${eventId}/tables`, {
        title: data.title,
        type: data.type,
        gmIsPlayer: data.type === "JDR" ? data.gmIsPlayer : undefined,
        pitch: data.pitch || undefined,
        triggers: data.triggers || undefined,
        comments: data.comments || undefined,
        maxPlayers: Number(data.maxPlayers),
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        tags: tags.length > 0 ? tags : undefined,
      });
      toast.success("Table creee !");
      reset();
      setTags([]);
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Echec de la creation";
      toast.error(message);
    }
  };

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Creer une table">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4 md:p-0 md:mt-4">
        <div className="form-control">
          <label className="label" htmlFor="ct-title">
            <span className="label-text">Titre</span>
          </label>
          <input
            id="ct-title"
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

        {/* Type JDR / JDS */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">Type de table</span>
          </label>
          <div className="flex gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                className="radio radio-primary"
                value="JDR"
                {...register("type")}
              />
              <span className="text-sm">JDR (jeu de role)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                className="radio radio-primary"
                value="JDS"
                {...register("type")}
              />
              <span className="text-sm">JDS (jeu de societe)</span>
            </label>
          </div>
        </div>

        {/* MJ joueur — uniquement pour JDR */}
        {tableType === "JDR" && (
          <div className="form-control">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                {...register("gmIsPlayer")}
              />
              <span className="label-text">Le MJ est aussi joueur (se compte dans les places)</span>
            </label>
          </div>
        )}

        <div className="form-control">
          <label className="label" htmlFor="ct-pitch">
            <span className="label-text">Pitch</span>
          </label>
          <textarea
            id="ct-pitch"
            className="textarea textarea-bordered w-full"
            rows={3}
            {...register("pitch", {
              maxLength: { value: 2000, message: "Max 2000 caracteres" },
            })}
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="ct-triggers">
            <span className="label-text">Triggers</span>
          </label>
          <textarea
            id="ct-triggers"
            className="textarea textarea-bordered w-full"
            rows={2}
            {...register("triggers", {
              maxLength: { value: 1000, message: "Max 1000 caracteres" },
            })}
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="ct-comments">
            <span className="label-text">Commentaires</span>
          </label>
          <textarea
            id="ct-comments"
            className="textarea textarea-bordered w-full"
            rows={2}
            {...register("comments", {
              maxLength: { value: 1000, message: "Max 1000 caracteres" },
            })}
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="ct-maxPlayers">
            <span className="label-text">Joueurs max</span>
          </label>
          <input
            id="ct-maxPlayers"
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
            <label className="label" htmlFor="ct-date">
              <span className="label-text">Date</span>
            </label>
            <input
              id="ct-date"
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
            <label className="label" htmlFor="ct-startTime">
              <span className="label-text">Heure de debut</span>
            </label>
            <input
              id="ct-startTime"
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
            <label className="label" htmlFor="ct-duration">
              <span className="label-text">Duree</span>
            </label>
            <select
              id="ct-duration"
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
            Creer
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
