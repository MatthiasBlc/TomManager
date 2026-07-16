import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import TagInput from "./TagInput";
import ResponsiveModal from "../common/ResponsiveModal";
import NumberStepper from "../common/NumberStepper";
import BoardGameSelector, { SelectedGame } from "./BoardGameSelector";

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
  reservedSeats: number;
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
  const [selectedGame, setSelectedGame] = useState<SelectedGame | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateTableForm>({
    defaultValues: {
      durationMinutes: 120,
      type: "JDR",
      gmIsPlayer: false,
      maxPlayers: 4,
      reservedSeats: 0,
    },
  });

  const tableType = watch("type");
  const maxPlayers = watch("maxPlayers");
  const reservedSeats = watch("reservedSeats");
  const gmIsPlayer = watch("gmIsPlayer");
  // Meme borne que le backend : le siege du MJ (JDS ou MJ joueur) n'est jamais
  // convertible en place reservee
  const gmTakesASeat = tableType === "JDS" || gmIsPlayer;
  const reservedSeatsMax = Math.max(0, (maxPlayers || 0) - (gmTakesASeat ? 1 : 0));
  // Reset gmIsPlayer when switching to JDS
  useEffect(() => {
    if (tableType === "JDS") setValue("gmIsPlayer", false);
  }, [tableType, setValue]);

  // Les places reservees ne peuvent jamais depasser la borne (joueurs max, moins le
  // siege du MJ le cas echeant — ex : maxPlayers baisse apres selection d'un jeu plus petit)
  useEffect(() => {
    if (reservedSeats > reservedSeatsMax) setValue("reservedSeats", reservedSeatsMax);
  }, [reservedSeatsMax, reservedSeats, setValue]);

  // Pre-remplissage reactif depuis le jeu selectionne (creation uniquement — ecrase a chaque changement)
  useEffect(() => {
    if (!selectedGame) return;
    if (selectedGame.maxPlayers) setValue("maxPlayers", selectedGame.maxPlayers);
    if (selectedGame.playingTime) {
      const values = DURATION_OPTIONS.map((o) => o.value);
      const snapped = values.reduce((prev, curr) =>
        Math.abs(curr - selectedGame.playingTime!) < Math.abs(prev - selectedGame.playingTime!)
          ? curr
          : prev
      );
      setValue("durationMinutes", snapped);
    }
  }, [selectedGame, setValue]);

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
        reservedSeats: Number(data.reservedSeats) || 0,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        tags: tags.length > 0 ? tags : undefined,
        boardGameId: selectedGame?.id ?? undefined,
      });
      toast.success("Table créée !");
      reset();
      setTags([]);
      setSelectedGame(null);
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Échec de la création";
      toast.error(message);
    }
  };

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Créer une table">
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
              maxLength: { value: 150, message: "Max 150 caractères" },
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
              <span className="text-sm">JDR (jeu de rôle)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                className="radio radio-primary"
                value="JDS"
                {...register("type")}
              />
              <span className="text-sm">JDS (jeu de société)</span>
            </label>
          </div>
        </div>

        {/* MJ joueur — uniquement pour JDR */}
        {tableType === "JDR" && (
          <div className="form-control">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-primary rounded-md"
                {...register("gmIsPlayer")}
              />
              <span className="label-text">Le MJ est aussi joueur (se compte dans les places)</span>
            </label>
          </div>
        )}

        {/* Jeu associe — uniquement pour JDS */}
        {tableType === "JDS" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text">Jeu associé</span>
              <span className="label-text-alt opacity-50">optionnel</span>
            </label>
            <BoardGameSelector value={selectedGame} onChange={setSelectedGame} />
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
              maxLength: { value: 2000, message: "Max 2000 caractères" },
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
              maxLength: { value: 1000, message: "Max 1000 caractères" },
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
              maxLength: { value: 1000, message: "Max 1000 caractères" },
            })}
          />
        </div>

        <div className="space-y-3">
          <div className="form-control">
            <label className="label" htmlFor="ct-maxPlayers">
              <span className="label-text">Joueurs max</span>
            </label>
            <NumberStepper
              id="ct-maxPlayers"
              value={maxPlayers}
              onChange={(v) => setValue("maxPlayers", v, { shouldValidate: true })}
              min={1}
              max={20}
            />
          </div>
          <div className="form-control">
            <label className="label" htmlFor="ct-reservedSeats">
              <span className="label-text">Places réservées</span>
            </label>
            <NumberStepper
              id="ct-reservedSeats"
              value={reservedSeats}
              onChange={(v) => setValue("reservedSeats", v, { shouldValidate: true })}
              min={0}
              max={reservedSeatsMax}
            />
            <p className="text-xs opacity-60 mt-1">
              Non accessibles à l'inscription publique — à affecter manuellement depuis la liste
              d'attente.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="form-control flex-1 min-w-[150px]">
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
          <div className="form-control flex-1 min-w-[120px]">
            <label className="label" htmlFor="ct-startTime">
              <span className="label-text">Heure de début</span>
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
          <div className="form-control flex-1 min-w-[110px]">
            <label className="label" htmlFor="ct-duration">
              <span className="label-text">Durée</span>
            </label>
            <select
              id="ct-duration"
              className="select select-bordered w-full"
              {...register("durationMinutes", {
                required: "Requis",
                valueAsNumber: true,
              })}
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
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting && <span className="loading loading-spinner loading-xs" />}
            Créer
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
