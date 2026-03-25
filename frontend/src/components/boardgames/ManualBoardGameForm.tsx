import { useForm } from "react-hook-form";

interface ManualFormData {
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
}

interface Props {
  onSubmit: (data: ManualFormData) => void;
  onCancel: () => void;
}

export default function ManualBoardGameForm({ onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualFormData>();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="form-control">
        <label className="label">
          <span className="label-text">Name</span>
        </label>
        <input
          type="text"
          className="input input-bordered"
          {...register("name", { required: "Name is required" })}
        />
        {errors.name && (
          <label className="label">
            <span className="label-text-alt text-error">{errors.name.message}</span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Year</span>
          </label>
          <input
            type="number"
            className="input input-bordered"
            {...register("yearPublished", { valueAsNumber: true })}
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Playing Time (min)</span>
          </label>
          <input
            type="number"
            className="input input-bordered"
            {...register("playingTime", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Min Players</span>
          </label>
          <input
            type="number"
            className="input input-bordered"
            min={1}
            {...register("minPlayers", { valueAsNumber: true })}
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Max Players</span>
          </label>
          <input
            type="number"
            className="input input-bordered"
            min={1}
            {...register("maxPlayers", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className="btn btn-sm" onClick={onCancel}>
          Back to search
        </button>
        <button type="submit" className="btn btn-primary btn-sm">
          Create & Add
        </button>
      </div>
    </form>
  );
}
