import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useEventSocket } from "../../hooks/useEventSocket";
import ResponsiveModal from "../common/ResponsiveModal";
import EditTableModal from "./EditTableModal";
import EmptyState from "../common/EmptyState";
import { SkeletonTableDetail } from "../common/Skeleton";

interface TableDetail {
  id: string;
  eventId: string;
  createdBy: string;
  title: string;
  type: "JDR" | "JDS";
  gmIsPlayer: boolean;
  pitch: string | null;
  triggers: string | null;
  comments: string | null;
  maxPlayers: number;
  startDateTime: string;
  endDateTime: string;
  creator: { id: string; username: string };
  tags: { id: string; name: string }[];
  participants: {
    userId: string;
    username: string;
    status: string;
    joinedAt: string;
  }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  tableId: string | null;
  eventId: string;
  onTableDeleted: () => void;
  onTableUpdated: () => void;
}

export default function TableDetailModal({
  open,
  onClose,
  tableId,
  eventId,
  onTableDeleted,
  onTableUpdated,
}: Props) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [table, setTable] = useState<TableDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const isGM = user?.id === table?.createdBy;
  const isAdmin = user?.role === "ADMIN";
  const canEdit = isGM || isAdmin;
  const currentParticipant = table?.participants.find((p) => p.userId === user?.id);
  const confirmedCount = table?.participants.filter((p) => p.status === "CONFIRMED").length ?? 0;
  const waitlistCount = table?.participants.filter((p) => p.status === "WAITLIST").length ?? 0;

  const fetchTable = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/events/${eventId}/tables/${tableId}`);
      setTable(res.data.data);
    } catch {
      toast.error("Failed to load table");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [eventId, tableId, onClose]);

  useEffect(() => {
    if (open && tableId) fetchTable();
    if (!open) setTable(null);
  }, [open, tableId, fetchTable]);

  useEventSocket(eventId, {
    onTableUpdated: fetchTable,
    onTableDeleted: () => {
      onTableDeleted();
      onClose();
    },
    onPlayerJoined: fetchTable,
    onPlayerLeft: fetchTable,
    onPlayerKicked: fetchTable,
    onPlayerPromoted: fetchTable,
    onPlayerDemoted: fetchTable,
  });

  const handleJoin = async () => {
    if (!table) return;
    try {
      const res = await api.post(`/api/events/${eventId}/tables/${table.id}/join`);
      const status = res.data.data.status;
      toast.success(status === "CONFIRMED" ? "Joined!" : "Added to waitlist");
      fetchTable();
      onTableUpdated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Failed to join";
      toast.error(message);
    }
  };

  const handleLeave = async () => {
    if (!table) return;
    if (!confirm("Leave this table?")) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${table.id}/leave`);
      toast.success("Left table");
      fetchTable();
      onTableUpdated();
    } catch {
      toast.error("Failed to leave table");
    }
  };

  const handlePromote = async (userId: string) => {
    if (!table) return;
    try {
      await api.patch(`/api/events/${eventId}/tables/${table.id}/participants/${userId}/status`, {
        status: "CONFIRMED",
      });
      toast.success("Joueur promu");
      fetchTable();
      onTableUpdated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Failed to promote player";
      toast.error(message);
    }
  };

  const handleDemote = async (userId: string) => {
    if (!table) return;
    try {
      await api.patch(`/api/events/${eventId}/tables/${table.id}/participants/${userId}/status`, {
        status: "WAITLIST",
      });
      toast.success("Joueur rétrogradé");
      fetchTable();
      onTableUpdated();
    } catch {
      toast.error("Failed to demote player");
    }
  };

  const handleKick = async (userId: string, username: string) => {
    if (!table) return;
    if (!confirm(`Remove ${username} from this table?`)) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${table.id}/participants/${userId}`);
      toast.success(`${username} removed`);
      fetchTable();
      onTableUpdated();
    } catch {
      toast.error("Failed to remove player");
    }
  };

  const handleDelete = async () => {
    if (!table) return;
    if (!confirm("Delete this table? This cannot be undone.")) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${table.id}`);
      toast.success("Table deleted");
      onTableDeleted();
      onClose();
    } catch {
      toast.error("Failed to delete table");
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const title = table?.title ?? "Table";

  return (
    <>
      <ResponsiveModal open={open} onClose={onClose} title={title} size="lg">
        {loading || !table ? (
          <div className="mt-4">
            <SkeletonTableDetail />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {/* Meta : type, GM, horaire */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge badge-outline badge-sm">{table.type}</span>
              {table.type === "JDR" && table.gmIsPlayer && (
                <span className="badge badge-ghost badge-sm">MJ joueur</span>
              )}
            </div>
            <div className="text-sm opacity-70 space-y-0.5">
              <p>
                {table.type === "JDR" ? "MJ" : "Createur"} : {table.creator.username}
              </p>
              <p>
                {formatDateTime(table.startDateTime)} → {formatDateTime(table.endDateTime)}
              </p>
              <p>
                {confirmedCount}/{table.maxPlayers} joueurs
                {waitlistCount > 0 && (
                  <span className="ml-2 badge badge-warning badge-xs">
                    +{waitlistCount} waitlist
                  </span>
                )}
              </p>
            </div>

            {/* Tags */}
            {table.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {table.tags.map((tag) => (
                  <span key={tag.id} className="badge badge-primary badge-sm">
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Pitch */}
            {table.pitch && (
              <div className="card bg-base-200 shadow-none">
                <div className="card-body p-3">
                  <h4 className="font-semibold text-sm">Pitch</h4>
                  <p className="whitespace-pre-wrap text-sm">{table.pitch}</p>
                </div>
              </div>
            )}

            {/* Triggers */}
            {table.triggers && (
              <div className="card bg-base-200 border-l-4 border-warning shadow-none">
                <div className="card-body p-3">
                  <h4 className="font-semibold text-sm">Triggers</h4>
                  <p className="whitespace-pre-wrap text-sm">{table.triggers}</p>
                </div>
              </div>
            )}

            {/* Comments */}
            {table.comments && (
              <div className="card bg-base-200 shadow-none">
                <div className="card-body p-3">
                  <h4 className="font-semibold text-sm">Commentaires</h4>
                  <p className="whitespace-pre-wrap text-sm">{table.comments}</p>
                </div>
              </div>
            )}

            {/* Participants */}
            <div className="card bg-base-200 shadow-none">
              <div className="card-body p-3">
                <h4 className="font-semibold text-sm mb-2">
                  Participants ({confirmedCount}/{table.maxPlayers})
                </h4>
                {table.participants.length === 0 ? (
                  <EmptyState icon={<span>👥</span>} title="No participants yet" />
                ) : isMobile ? (
                  <div className="space-y-1">
                    {table.participants.map((p) => (
                      <div key={p.userId} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{p.username}</span>
                          <span
                            className={`badge badge-xs ${
                              p.status === "CONFIRMED" ? "badge-success" : "badge-warning"
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            {p.status === "WAITLIST" && (
                              <button
                                className="btn btn-ghost btn-xs text-success min-h-[44px]"
                                onClick={() => handlePromote(p.userId)}
                                disabled={confirmedCount >= table.maxPlayers}
                                title={
                                  confirmedCount >= table.maxPlayers
                                    ? "Table pleine — retrogradez un joueur d'abord"
                                    : "Promouvoir"
                                }
                              >
                                Promouvoir
                              </button>
                            )}
                            {p.status === "CONFIRMED" && (
                              <button
                                className="btn btn-ghost btn-xs text-warning min-h-[44px]"
                                onClick={() => handleDemote(p.userId)}
                              >
                                Retrograder
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-xs text-error min-h-[44px]"
                              onClick={() => handleKick(p.userId, p.username)}
                            >
                              Retirer
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-xs">
                      <thead>
                        <tr>
                          <th>Joueur</th>
                          <th>Statut</th>
                          {canEdit && <th />}
                        </tr>
                      </thead>
                      <tbody>
                        {table.participants.map((p) => (
                          <tr key={p.userId}>
                            <td>{p.username}</td>
                            <td>
                              <span
                                className={`badge badge-xs ${
                                  p.status === "CONFIRMED" ? "badge-success" : "badge-warning"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            {canEdit && (
                              <td className="flex gap-1">
                                {p.status === "WAITLIST" && (
                                  <button
                                    className="btn btn-ghost btn-xs text-success"
                                    onClick={() => handlePromote(p.userId)}
                                    disabled={confirmedCount >= table.maxPlayers}
                                    title={
                                      confirmedCount >= table.maxPlayers
                                        ? "Table pleine — retrogradez un joueur d'abord"
                                        : "Promouvoir"
                                    }
                                  >
                                    Promouvoir
                                  </button>
                                )}
                                {p.status === "CONFIRMED" && (
                                  <button
                                    className="btn btn-ghost btn-xs text-warning"
                                    onClick={() => handleDemote(p.userId)}
                                  >
                                    Retrograder
                                  </button>
                                )}
                                <button
                                  className="btn btn-ghost btn-xs text-error"
                                  onClick={() => handleKick(p.userId, p.username)}
                                >
                                  Retirer
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className={`flex flex-wrap gap-2 pt-1 ${isMobile ? "pb-2" : ""}`}>
              {!currentParticipant && (!isGM || table.type === "JDS" || table.gmIsPlayer) && (
                <button className="btn btn-primary btn-sm flex-1 md:flex-none" onClick={handleJoin}>
                  Rejoindre
                </button>
              )}
              {currentParticipant && (
                <button
                  className="btn btn-outline btn-warning btn-sm flex-1 md:flex-none"
                  onClick={handleLeave}
                >
                  {isGM ? "Supprimer la table (quitter)" : "Quitter"}
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    className="btn btn-outline btn-sm flex-1 md:flex-none"
                    onClick={() => setShowEdit(true)}
                  >
                    Modifier
                  </button>
                  <button
                    className="btn btn-outline btn-error btn-sm flex-1 md:flex-none"
                    onClick={handleDelete}
                  >
                    Supprimer
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </ResponsiveModal>

      {table && (
        <EditTableModal
          open={showEdit}
          onClose={() => setShowEdit(false)}
          onUpdated={() => {
            fetchTable();
            onTableUpdated();
          }}
          eventId={eventId}
          table={table}
        />
      )}
    </>
  );
}
