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
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const handleRemove = async (userId: string) => {
    if (!confirm("Retirer ce participant ?")) return;
    setRemovingUserId(userId);
    try {
      await api.delete(`/api/events/${eventId}/participants/${userId}`);
      toast.success("Participant retiré");
      onChanged();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Échec du retrait du participant";
      toast.error(message);
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleLeave = async () => {
    if (!confirm("Quitter cet événement ?")) return;
    setLeaving(true);
    try {
      await api.delete(`/api/events/${eventId}/participants/me`);
      toast.success("Vous avez quitté l'événement");
      onChanged();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Échec en quittant l'événement";
      toast.error(message);
    } finally {
      setLeaving(false);
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
        title="Aucun participant pour l'instant"
        description="Partagez le lien de l'événement pour inviter des gens."
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
        <option value="role">Par rôle</option>
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
              <div className="card-body p-3 flex-row items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{displayedName(p)}</p>
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
                    className="btn btn-ghost btn-sm text-error min-h-[44px] flex-shrink-0"
                    onClick={() => handleRemove(p.userId)}
                    disabled={removingUserId === p.userId}
                  >
                    Retirer
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
                <th>Rôle</th>
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
                          disabled={removingUserId === p.userId}
                        >
                          Retirer
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
          Aucun participant dans cette catégorie.
        </p>
      )}

      {!isCreator && user && (
        <div className="mt-4">
          <button
            className="btn btn-outline btn-error btn-sm"
            onClick={handleLeave}
            disabled={leaving}
          >
            Quitter l'événement
          </button>
        </div>
      )}
    </div>
  );
}
