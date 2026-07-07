import { useForm } from "react-hook-form";
import NumberStepper from "../common/NumberStepper";

interface ManualFormData {
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
}

interface Props {
  onSubmit: (data: ManualFormData) => void | Promise<void>;
  onCancel: () => void;
}

export default function ManualBoardGameForm({ onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ManualFormData>({
    defaultValues: { minPlayers: 1, maxPlayers: 4, playingTime: 30 },
  });
  const minPlayers = watch("minPlayers") ?? 1;
  const maxPlayers = watch("maxPlayers") ?? 1;
  const playingTime = watch("playingTime") ?? 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="form-control">
        <label className="label" htmlFor="mbg-name">
          <span className="label-text">Nom</span>
        </label>
        <input
          id="mbg-name"
          type="text"
          className="input input-bordered"
          {...register("name", { required: "Le nom est obligatoire" })}
        />
        {errors.name && (
          <label className="label">
            <span className="label-text-alt text-error">{errors.name.message}</span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="form-control">
          <label className="label" htmlFor="mbg-year">
            <span className="label-text">Annee</span>
          </label>
          <input
            id="mbg-year"
            type="number"
            className="input input-bordered"
            {...register("yearPublished", { valueAsNumber: true })}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="mbg-playingTime">
            <span className="label-text">Duree (min)</span>
          </label>
          <NumberStepper
            id="mbg-playingTime"
            value={playingTime}
            onChange={(v) => setValue("playingTime", v, { shouldValidate: true })}
            min={0}
            step={15}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="form-control">
          <label className="label" htmlFor="mbg-minPlayers">
            <span className="label-text">Joueurs min</span>
          </label>
          <NumberStepper
            id="mbg-minPlayers"
            value={minPlayers}
            onChange={(v) => setValue("minPlayers", v, { shouldValidate: true })}
            min={1}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="mbg-maxPlayers">
            <span className="label-text">Joueurs max</span>
          </label>
          <NumberStepper
            id="mbg-maxPlayers"
            value={maxPlayers}
            onChange={(v) => setValue("maxPlayers", v, { shouldValidate: true })}
            min={1}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className="btn btn-sm" onClick={onCancel} disabled={isSubmitting}>
          Retour a la recherche
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
          {isSubmitting && <span className="loading loading-spinner loading-xs" />}
          Creer et ajouter
        </button>
      </div>
    </form>
  );
}
