import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import ResponsiveModal from "../common/ResponsiveModal";

interface CreateEventForm {
  name: string;
  startDateTime: string;
  endDateTime: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateEventModal({ open, onClose, onCreated }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEventForm>();

  const onSubmit = async (data: CreateEventForm) => {
    try {
      await api.post("/api/events", {
        name: data.name,
        startDateTime: new Date(data.startDateTime).toISOString(),
        endDateTime: new Date(data.endDateTime).toISOString(),
      });
      toast.success("Event created!");
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Failed to create event";
      toast.error(message);
    }
  };

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Create Event">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 md:p-0 md:mt-4">
        <div className="form-control">
          <label className="label" htmlFor="ce-name">
            <span className="label-text">Name</span>
          </label>
          <input
            id="ce-name"
            type="text"
            className="input input-bordered w-full"
            {...register("name", {
              required: "Name is required",
              maxLength: { value: 100, message: "Max 100 characters" },
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
            <span className="label-text">Start</span>
          </label>
          <input
            id="ce-start"
            type="datetime-local"
            className="input input-bordered w-full"
            {...register("startDateTime", { required: "Start date is required" })}
          />
          {errors.startDateTime && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.startDateTime.message}</span>
            </label>
          )}
        </div>
        <div className="form-control">
          <label className="label" htmlFor="ce-end">
            <span className="label-text">End</span>
          </label>
          <input
            id="ce-end"
            type="datetime-local"
            className="input input-bordered w-full"
            {...register("endDateTime", { required: "End date is required" })}
          />
          {errors.endDateTime && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.endDateTime.message}</span>
            </label>
          )}
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
