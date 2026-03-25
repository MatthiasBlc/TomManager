import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../../config/api";
import TagInput from "./TagInput";

interface CreateTableForm {
  title: string;
  pitch: string;
  triggers: string;
  comments: string;
  maxPlayers: number;
  startDateTime: string;
  endDateTime: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  eventId: string;
}

export default function CreateTableModal({ open, onClose, onCreated, eventId }: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTableForm>();

  const onSubmit = async (data: CreateTableForm) => {
    try {
      await api.post(`/api/events/${eventId}/tables`, {
        title: data.title,
        pitch: data.pitch || undefined,
        triggers: data.triggers || undefined,
        comments: data.comments || undefined,
        maxPlayers: Number(data.maxPlayers),
        startDateTime: new Date(data.startDateTime).toISOString(),
        endDateTime: new Date(data.endDateTime).toISOString(),
        tags: tags.length > 0 ? tags : undefined,
      });
      toast.success("Table created!");
      reset();
      setTags([]);
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to create table";
      toast.error(message);
    }
  };

  if (!open) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg">Create Table</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Title</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
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
              className="textarea textarea-bordered"
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
              className="textarea textarea-bordered"
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
              className="textarea textarea-bordered"
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
              className="input input-bordered"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Start</span>
              </label>
              <input
                type="datetime-local"
                className="input input-bordered"
                {...register("startDateTime", { required: "Start is required" })}
              />
              {errors.startDateTime && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.startDateTime.message}</span>
                </label>
              )}
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">End</span>
              </label>
              <input
                type="datetime-local"
                className="input input-bordered"
                {...register("endDateTime", { required: "End is required" })}
              />
              {errors.endDateTime && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.endDateTime.message}</span>
                </label>
              )}
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Tags</span>
            </label>
            <TagInput value={tags} onChange={setTags} />
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}
