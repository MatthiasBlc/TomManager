import { useForm } from "react-hook-form";
import { useEffect } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";

interface EditEventForm {
  name: string;
  startDateTime: string;
  endDateTime: string;
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
  } | null;
}

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventModal({ open, onClose, onUpdated, event }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditEventForm>();

  useEffect(() => {
    if (event && open) {
      reset({
        name: event.name,
        startDateTime: toLocalDatetime(event.startDateTime),
        endDateTime: toLocalDatetime(event.endDateTime),
      });
    }
  }, [event, open, reset]);

  const onSubmit = async (data: EditEventForm) => {
    if (!event) return;
    try {
      await api.patch(`/api/events/${event.id}`, {
        name: data.name,
        startDateTime: new Date(data.startDateTime).toISOString(),
        endDateTime: new Date(data.endDateTime).toISOString(),
      });
      toast.success("Event updated!");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to update event";
      toast.error(message);
    }
  };

  if (!open || !event) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Edit Event</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
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
            <label className="label">
              <span className="label-text">Start</span>
            </label>
            <input
              type="datetime-local"
              className="input input-bordered"
              {...register("startDateTime", { required: "Start date is required" })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">End</span>
            </label>
            <input
              type="datetime-local"
              className="input input-bordered"
              {...register("endDateTime", { required: "End date is required" })}
            />
          </div>
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}
