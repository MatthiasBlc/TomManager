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

interface TableData {
  id: string;
  title: string;
  type: "JDR" | "JDS";
  gmIsPlayer: boolean;
  pitch: string | null;
  triggers: string | null;
  comments: string | null;
  maxPlayers: number;
  reservedSeats: number;
  startDateTime: string;
  endDateTime: string;
  tags: { id: string; name: string }[];
  participants: { userId: string; status: string; isOnReservedSeat: boolean }[];
  boardGame?: {
    id: string;
    name: string;
    maxPlayers?: number | null;
    playingTime?: number | null;
  } | null;
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
  const [selectedGame, setSelectedGame] = useState<SelectedGame | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditTableForm>();

  const confirmedCount = table.participants.filter((p) => p.status === "CONFIRMED").length;
  const waitlistCount = table.participants.filter((p) => p.status === "WAITLIST").length;
  const confirmedOnReserved = table.participants.filter(
    (p) => p.status === "CONFIRMED" && p.isOnReservedSeat
  ).length;

  const watchedMaxPlayers = watch("maxPlayers");
  const watchedReservedSeats = watch("reservedSeats");
  const newReservedSeats = Math.min(watchedReservedSeats || 0, watchedMaxPlayers || 0);
  const targetConfirmed = Math.max(0, (watchedMaxPlayers || 0) - newReservedSeats);
  const toDemoteCount = Math.max(0, confirmedCount - targetConfirmed);

  // Les places reservees ne peuvent jamais depasser le nombre de joueurs max
  useEffect(() => {
    if (watchedReservedSeats > watchedMaxPlayers) setValue("reservedSeats", watchedMaxPlayers);
  }, [watchedMaxPlayers, watchedReservedSeats, setValue]);

  useEffect(() => {
    if (open && table) {
      const durationMs =
        new Date(table.endDateTime).getTime() - new Date(table.startDateTime).getTime();
      reset({
        title: table.title,
        gmIsPlayer: table.gmIsPlayer,
        pitch: table.pitch || "",
        triggers: table.triggers || "",
        comments: table.comments || "",
        maxPlayers: table.maxPlayers,
        reservedSeats: table.reservedSeats,
        date: toLocalDate(table.startDateTime),
        startTime: toLocalTime(table.startDateTime),
        durationMinutes: snapDuration(durationMs),
      });
      setTags(table.tags.map((t) => t.name));
      setSelectedGame(
        table.boardGame
          ? {
              id: table.boardGame.id,
              name: table.boardGame.name,
              maxPlayers: table.boardGame.maxPlayers,
              playingTime: table.boardGame.playingTime,
            }
          : null
      );
    }
  }, [open, table, reset]);

  // Pre-remplissage one-shot en edition : ne remplir que les champs vides
  const handleGameChange = (game: SelectedGame | null) => {
    setSelectedGame(game);
    if (!game) return;
    const currentMaxPlayers = watch("maxPlayers");
    if (!currentMaxPlayers && game.maxPlayers) setValue("maxPlayers", game.maxPlayers);
    if (game.playingTime) {
      const currentDuration = watch("durationMinutes");
      if (!currentDuration) {
        const values = DURATION_OPTIONS.map((o) => o.value);
        const snapped = values.reduce((prev, curr) =>
          Math.abs(curr - game.playingTime!) < Math.abs(prev - game.playingTime!) ? curr : prev
        );
        setValue("durationMinutes", snapped);
      }
    }
  };

  const onSubmit = async (data: EditTableForm) => {
    if (
      toDemoteCount > 0 &&
      !confirm(
        `${toDemoteCount} joueur${toDemoteCount > 1 ? "s" : ""} confirme${toDemoteCount > 1 ? "s" : ""} ${toDemoteCount > 1 ? "seront" : "sera"} mis en liste d'attente si vous enregistrez ces valeurs. Continuer ?`
      )
    ) {
      return;
    }
    try {
      const startDateTime = new Date(`${data.date}T${data.startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + Number(data.durationMinutes) * 60000);

      await api.patch(`/api/events/${eventId}/tables/${table.id}`, {
        title: data.title,
        gmIsPlayer: table.type === "JDR" ? data.gmIsPlayer : undefined,
        pitch: data.pitch || null,
        triggers: data.triggers || null,
        comments: data.comments || null,
        maxPlayers: Number(data.maxPlayers),
        reservedSeats: Number(data.reservedSeats) || 0,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        tags,
        boardGameId: selectedGame?.id ?? null,
      });
      toast.success("Table mise a jour !");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Echec de la mise a jour";
      toast.error(message);
    }
  };

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Modifier la table">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4 md:p-0 md:mt-4">
        {/* Type — lecture seule */}
        <div className="flex items-center gap-2">
          <span className="badge badge-outline badge-sm">{table.type}</span>
          <span className="text-xs opacity-60">Le type ne peut pas etre modifie</span>
        </div>

        {/* MJ joueur — uniquement pour JDR */}
        {table.type === "JDR" && (
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

        {/* Jeu associe — uniquement pour JDS */}
        {table.type === "JDS" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text">Jeu associe</span>
              <span className="label-text-alt opacity-50">optionnel</span>
            </label>
            <BoardGameSelector value={selectedGame} onChange={handleGameChange} />
          </div>
        )}

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

        <div className="text-xs opacity-70 bg-base-200 rounded-lg p-2">
          Actuellement : {confirmedCount}/{table.maxPlayers} confirmes
          {confirmedOnReserved > 0 && ` (${confirmedOnReserved} sur place reservee)`}
          {waitlistCount > 0 && `, ${waitlistCount} en liste d'attente`}
        </div>
        {toDemoteCount > 0 && (
          <div className="text-xs text-warning font-medium bg-warning/10 rounded-lg p-2">
            ⚠ {toDemoteCount} joueur{toDemoteCount > 1 ? "s" : ""} confirme
            {toDemoteCount > 1 ? "s" : ""} {toDemoteCount > 1 ? "seront" : "sera"} mis en liste
            d'attente si vous enregistrez ces valeurs.
          </div>
        )}

        <div className="space-y-3">
          <div className="form-control">
            <label className="label" htmlFor="et-maxPlayers">
              <span className="label-text">Joueurs max</span>
            </label>
            <NumberStepper
              id="et-maxPlayers"
              value={watchedMaxPlayers}
              onChange={(v) => setValue("maxPlayers", v, { shouldValidate: true })}
              min={1}
              max={20}
            />
          </div>
          <div className="form-control">
            <label className="label" htmlFor="et-reservedSeats">
              <span className="label-text">Places reservees</span>
            </label>
            <NumberStepper
              id="et-reservedSeats"
              value={watchedReservedSeats}
              onChange={(v) => setValue("reservedSeats", v, { shouldValidate: true })}
              min={0}
              max={watchedMaxPlayers}
            />
            <p className="text-xs opacity-60 mt-1">
              Non accessibles a l'inscription publique — a affecter manuellement depuis la liste
              d'attente.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="form-control flex-1 min-w-[150px]">
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
          <div className="form-control flex-1 min-w-[120px]">
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
          <div className="form-control flex-1 min-w-[110px]">
            <label className="label" htmlFor="et-duration">
              <span className="label-text">Duree</span>
            </label>
            <select
              id="et-duration"
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
          <button type="submit" className="btn btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
