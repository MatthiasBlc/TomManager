import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import EmptyState from "../common/EmptyState";

interface Participant {
  userId: string;
  username: string;
  displayName?: string | null;
  role: string;
  joinedAt: string;
}

interface Props {
  eventId: string;
  createdBy: string;
  participants: Participant[];
  onChanged: () => void;
}

type SortKey = "name" | "joined" | "role";
type FilterKey = "all" | "ADMIN" | "USER";

export default function ParticipantList({ eventId, createdBy, participants, onChanged }: Props) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isCreator = user?.id === createdBy;

  const [sort, setSort] = useState<SortKey>("joined");
  const [filter, setFilter] = useState<FilterKey>("all");

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this participant?")) return;
    try {
      await api.delete(`/api/events/${eventId}/participants/${userId}`);
      toast.success("Participant removed");
      onChanged();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Failed to remove participant";
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
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Failed to leave event";
      toast.error(message);
    }
  };

  const displayedName = (p: Participant) => p.displayName ?? p.username;

  const processed = useMemo(() => {
    const filtered =
      filter === "all" ? participants : participants.filter((p) => p.role === filter);

    return [...filtered].sort((a, b) => {
      if (sort === "name") return displayedName(a).localeCompare(displayedName(b), "fr");
      if (sort === "role") {
        if (a.role === b.role) return displayedName(a).localeCompare(displayedName(b), "fr");
        return a.role === "ADMIN" ? -1 : 1;
      }
      // joined (default)
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
  }, [participants, sort, filter]);

  if (participants.length === 0) {
    return (
      <EmptyState
        icon={<span>👥</span>}
        title="No participants yet"
        description="Share the event link to invite people."
      />
    );
  }

  const controls = (
    <div className="flex flex-wrap gap-2 mb-3">
      <select
        className="select select-sm select-bordered"
        value={filter}
        onChange={(e) => setFilter(e.target.value as FilterKey)}
        aria-label="Filter participants"
      >
        <option value="all">Tous ({participants.length})</option>
        <option value="ADMIN">Admins</option>
        <option value="USER">Membres</option>
      </select>
      <select
        className="select select-sm select-bordered"
        value={sort}
        onChange={(e) => setSort(e.target.value as SortKey)}
        aria-label="Sort participants"
      >
        <option value="joined">Par date d'inscription</option>
        <option value="name">Par nom (A-Z)</option>
        <option value="role">Par role</option>
      </select>
    </div>
  );

  return (
    <div>
      {controls}

      {isMobile ? (
        <div className="space-y-2 animate-fade-in">
          {processed.map((p) => (
            <div
              key={p.userId}
              className="card bg-base-100 shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="card-body p-3 flex-row items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{displayedName(p)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`badge badge-sm ${p.role === "ADMIN" ? "badge-primary" : "badge-ghost"}`}
                    >
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
                <th>Nom</th>
                <th>Role</th>
                <th>Inscrit le</th>
                {isCreator && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {processed.map((p) => (
                <tr key={p.userId}>
                  <td>{displayedName(p)}</td>
                  <td>
                    <span
                      className={`badge ${p.role === "ADMIN" ? "badge-primary" : "badge-ghost"}`}
                    >
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

      {processed.length === 0 && (
        <p className="text-sm opacity-60 text-center py-4">
          Aucun participant dans cette categorie.
        </p>
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
