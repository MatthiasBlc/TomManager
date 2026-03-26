import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useIsMobile } from "../../hooks/useIsMobile";

interface Participant {
  userId: string;
  username: string;
  role: string;
  joinedAt: string;
}

interface Props {
  eventId: string;
  createdBy: string;
  participants: Participant[];
  onChanged: () => void;
}

export default function ParticipantList({ eventId, createdBy, participants, onChanged }: Props) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isCreator = user?.id === createdBy;

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this participant?")) return;
    try {
      await api.delete(`/api/events/${eventId}/participants/${userId}`);
      toast.success("Participant removed");
      onChanged();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to remove participant";
      toast.error(message);
    }
  };

  const handleLeave = async () => {
    if (!confirm("Leave this event?")) return;
    try {
      await api.delete(`/api/events/${eventId}/participants/me`);
      toast.success("You left the event");
      onChanged();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to leave event";
      toast.error(message);
    }
  };

  return (
    <div>
      {isMobile ? (
        <div className="space-y-2">
          {participants.map((p) => (
            <div key={p.userId} className="card bg-base-100 shadow-sm">
              <div className="card-body p-3 flex-row items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{p.username}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge badge-sm ${p.role === "ADMIN" ? "badge-primary" : "badge-ghost"}`}>
                      {p.role}
                    </span>
                    <span className="text-xs opacity-60">
                      {new Date(p.joinedAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
                {isCreator && p.userId !== createdBy && (
                  <button
                    className="btn btn-ghost btn-sm text-error min-h-[44px]"
                    onClick={() => handleRemove(p.userId)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Joined</th>
                {isCreator && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.userId}>
                  <td>{p.username}</td>
                  <td>
                    <span className={`badge ${p.role === "ADMIN" ? "badge-primary" : "badge-ghost"}`}>
                      {p.role}
                    </span>
                  </td>
                  <td>{new Date(p.joinedAt).toLocaleDateString("fr-FR")}</td>
                  {isCreator && (
                    <td>
                      {p.userId !== createdBy && (
                        <button
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() => handleRemove(p.userId)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isCreator && user && (
        <div className="mt-4">
          <button className="btn btn-outline btn-error btn-sm" onClick={handleLeave}>
            Leave event
          </button>
        </div>
      )}
    </div>
  );
}
