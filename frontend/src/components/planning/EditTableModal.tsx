import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import TagInput from "./TagInput";
import ResponsiveModal from "../common/ResponsiveModal";

interface EditTableForm {
  title: string;
  pitch: string;
  triggers: string;
  comments: string;
  maxPlayers: number;
  startDateTime: string;
  endDateTime: string;
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

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
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
      reset({
        title: table.title,
        pitch: table.pitch || "",
        triggers: table.triggers || "",
        comments: table.comments || "",
        maxPlayers: table.maxPlayers,
        startDateTime: toLocalDatetime(table.startDateTime),
        endDateTime: toLocalDatetime(table.endDateTime),
      });
      setTags(table.tags.map((t) => t.name));
    }
  }, [open, table, reset]);

  const onSubmit = async (data: EditTableForm) => {
    try {
      await api.patch(`/api/events/${eventId}/tables/${table.id}`, {
        title: data.title,
        pitch: data.pitch || null,
        triggers: data.triggers || null,
        comments: data.comments || null,
        maxPlayers: Number(data.maxPlayers),
        startDateTime: new Date(data.startDateTime).toISOString(),
        endDateTime: new Date(data.endDateTime).toISOString(),
        tags,
      });
      toast.success("Table updated!");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to update table";
      toast.error(message);
    }
  };

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Edit Table">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4 md:p-0 md:mt-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Title</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            {...register("title", {
              required: "Title is required",
              maxLength: { value: 150, message: "Max 150 characters" },
            })}
          />
          {errors.title && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.title.message}</span>
            </label>
          )}
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Pitch</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            {...register("pitch", {
              maxLength: { value: 2000, message: "Max 2000 characters" },
            })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Triggers</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={2}
            {...register("triggers", {
              maxLength: { value: 1000, message: "Max 1000 characters" },
            })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Comments</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={2}
            {...register("comments", {
              maxLength: { value: 1000, message: "Max 1000 characters" },
            })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Max Players</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            inputMode="numeric"
            min={1}
            max={20}
            {...register("maxPlayers", {
              required: "Max players is required",
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Start</span>
            </label>
            <input
              type="datetime-local"
              className="input input-bordered w-full"
              {...register("startDateTime", { required: "Start is required" })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">End</span>
            </label>
            <input
              type="datetime-local"
              className="input input-bordered w-full"
              {...register("endDateTime", { required: "End is required" })}
            />
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
