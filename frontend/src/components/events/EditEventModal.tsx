import { useForm } from "react-hook-form";
import { useEffect } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import ResponsiveModal from "../common/ResponsiveModal";

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

  if (!event) return null;

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Edit Event">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 md:p-0 md:mt-4">
        <div className="form-control">
          <label className="label" htmlFor="ee-name">
            <span className="label-text">Name</span>
          </label>
          <input
            id="ee-name"
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
          <label className="label" htmlFor="ee-start">
            <span className="label-text">Start</span>
          </label>
          <input
            id="ee-start"
            type="datetime-local"
            className="input input-bordered w-full"
            {...register("startDateTime", { required: "Start date is required" })}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="ee-end">
            <span className="label-text">End</span>
          </label>
          <input
            id="ee-end"
            type="datetime-local"
            className="input input-bordered w-full"
            {...register("endDateTime", { required: "End date is required" })}
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
