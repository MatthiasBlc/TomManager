import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import { useAuth } from "../contexts/AuthContext";
import { useIsMobile } from "../hooks/useIsMobile";
import EditTableModal from "../components/planning/EditTableModal";
import { useEventSocket } from "../hooks/useEventSocket";
import { SkeletonTableDetail } from "../components/common/Skeleton";
import EmptyState from "../components/common/EmptyState";

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
  reservedSeats: number;
  startDateTime: string;
  endDateTime: string;
  creator: { id: string; username: string };
  tags: { id: string; name: string }[];
  participants: {
    userId: string;
    username: string;
    status: string;
    isOnReservedSeat: boolean;
    joinedAt: string;
  }[];
}

export default function TableDetailPage() {
  const { eventId, tableId } = useParams<{
    eventId: string;
    tableId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [table, setTable] = useState<TableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const isGM = user?.id === table?.createdBy;
  const isAdmin = user?.role === "ADMIN";
  const canEdit = isGM || isAdmin;
  const currentParticipant = table?.participants.find((p) => p.userId === user?.id);
  const confirmedCount = table?.participants.filter((p) => p.status === "CONFIRMED").length ?? 0;
  const waitlistCount = table?.participants.filter((p) => p.status === "WAITLIST").length ?? 0;
  const openSeats = table ? table.maxPlayers - confirmedCount - table.reservedSeats : 0;

  const fetchTable = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/tables/${tableId}`);
      setTable(res.data.data);
    } catch {
      toast.error("Echec du chargement de la table");
      navigate(`/events/${eventId}/planning`);
    } finally {
      setLoading(false);
    }
  }, [eventId, tableId, navigate]);

  useEffect(() => {
    fetchTable();
  }, [fetchTable]);

  useEventSocket(eventId, {
    onTableUpdated: fetchTable,
    onTableDeleted: () => navigate(`/events/${eventId}/planning`),
    onPlayerJoined: fetchTable,
    onPlayerLeft: fetchTable,
    onPlayerKicked: fetchTable,
    onPlayerPromoted: fetchTable,
    onPlayerDemoted: fetchTable,
  });

  const handleJoin = async () => {
    try {
      const res = await api.post(`/api/events/${eventId}/tables/${tableId}/join`);
      const status = res.data.data.status;
      toast.success(status === "CONFIRMED" ? "Inscrit !" : "Ajoute sur la liste d'attente");
      fetchTable();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Echec de l'inscription";
      toast.error(message);
    }
  };

  const handleLeave = async () => {
    if (!confirm("Quitter cette table ?")) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${tableId}/leave`);
      toast.success("Vous avez quitte la table");
      fetchTable();
    } catch {
      toast.error("Echec en quittant la table");
    }
  };

  const handleKick = async (userId: string, username: string) => {
    if (!confirm(`Retirer ${username} de cette table ?`)) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${tableId}/participants/${userId}`);
      toast.success(`${username} retire de la table`);
      fetchTable();
    } catch {
      toast.error("Erreur lors du retrait du joueur");
    }
  };

  const handleSetStatus = async (userId: string, status: "CONFIRMED" | "WAITLIST") => {
    try {
      await api.patch(`/api/events/${eventId}/tables/${tableId}/participants/${userId}/status`, {
        status,
      });
      fetchTable();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Echec du changement de statut";
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer cette table ? Cette action est irreversible.")) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${tableId}`);
      toast.success("Table supprimee");
      navigate(`/events/${eventId}/planning`);
    } catch {
      toast.error("Echec de la suppression de la table");
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-3xl">
        <SkeletonTableDetail />
      </div>
    );
  }

  if (!table) return null;

  const promoteLabel = table.reservedSeats > 0 ? "Affecter (place reservee)" : "Promouvoir";

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-3xl animate-fade-in">
      {!isMobile && (
        <button
          className="btn btn-ghost btn-sm mb-4"
          onClick={() => navigate(`/events/${eventId}/planning`)}
        >
          &larr; Retour au planning
        </button>
      )}

      <div className="mb-4 md:mb-6">
        <h1 className="text-lg font-bold md:text-2xl">{table.title}</h1>
        <p className="text-xs opacity-70 mt-1 md:text-sm">MJ : {table.creator.username}</p>
        <p className="text-xs opacity-70 md:text-sm">
          {formatDateTime(table.startDateTime)} - {formatDateTime(table.endDateTime)}
        </p>
      </div>

      {table.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {table.tags.map((tag) => (
            <span key={tag.id} className="badge badge-primary badge-sm">
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3 md:space-y-4">
        {table.pitch && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-3 md:p-4">
              <h3 className="font-semibold text-sm">Pitch</h3>
              <p className="whitespace-pre-wrap text-sm">{table.pitch}</p>
            </div>
          </div>
        )}

        {table.triggers && (
          <div className="card bg-base-100 shadow-sm border-l-4 border-warning">
            <div className="card-body p-3 md:p-4">
              <h3 className="font-semibold text-sm">Triggers</h3>
              <p className="whitespace-pre-wrap text-sm">{table.triggers}</p>
            </div>
          </div>
        )}

        {table.comments && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-3 md:p-4">
              <h3 className="font-semibold text-sm">Commentaires</h3>
              <p className="whitespace-pre-wrap text-sm">{table.comments}</p>
            </div>
          </div>
        )}

        {/* Bloc capacite */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-3 md:p-4">
            <h3 className="font-semibold text-sm mb-2">
              Participants ({confirmedCount}/{table.maxPlayers})
            </h3>

            {/* Repartition des places */}
            {(table.reservedSeats > 0 || openSeats > 0) && (
              <div className="flex flex-wrap gap-2 mb-3 text-xs">
                {table.reservedSeats > 0 && (
                  <span className="badge badge-outline badge-warning gap-1">
                    {table.reservedSeats} reservee{table.reservedSeats > 1 ? "s" : ""}
                  </span>
                )}
                {openSeats > 0 && (
                  <span className="badge badge-outline badge-success gap-1">
                    {openSeats} libre{openSeats > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}

            {confirmedCount === 0 ? (
              <EmptyState icon={<span>👥</span>} title="Aucun participant pour l'instant" />
            ) : isMobile ? (
              <div className="space-y-2">
                {table.participants
                  .filter((p) => p.status === "CONFIRMED")
                  .map((p) => (
                    <div key={p.userId} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.username}</span>
                        {p.isOnReservedSeat && (
                          <span className="badge badge-warning badge-xs">reservee</span>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button
                            className="btn btn-ghost btn-sm text-warning min-h-[44px]"
                            onClick={() => handleSetStatus(p.userId, "WAITLIST")}
                          >
                            Retrograder
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-error min-h-[44px]"
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
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Joueur</th>
                      {canEdit && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {table.participants
                      .filter((p) => p.status === "CONFIRMED")
                      .map((p) => (
                        <tr key={p.userId}>
                          <td>
                            <div className="flex items-center gap-2">
                              {p.username}
                              {p.isOnReservedSeat && (
                                <span className="badge badge-warning badge-xs">reservee</span>
                              )}
                            </div>
                          </td>
                          {canEdit && (
                            <td>
                              <div className="flex gap-1">
                                <button
                                  className="btn btn-ghost btn-xs text-warning"
                                  onClick={() => handleSetStatus(p.userId, "WAITLIST")}
                                >
                                  Retrograder
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs text-error"
                                  onClick={() => handleKick(p.userId, p.username)}
                                >
                                  Retirer
                                </button>
                              </div>
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

        {waitlistCount > 0 && (
          <div className="card bg-base-100 shadow-sm border-l-4 border-warning">
            <div className="card-body p-3 md:p-4">
              <h3 className="font-semibold text-sm mb-2">Liste d'attente ({waitlistCount})</h3>
              {isMobile ? (
                <div className="space-y-2">
                  {table.participants
                    .filter((p) => p.status === "WAITLIST")
                    .map((p) => (
                      <div key={p.userId} className="flex items-center justify-between py-1">
                        <span className="text-sm font-medium">{p.username}</span>
                        {canEdit && (
                          <div className="flex gap-1">
                            <button
                              className="btn btn-ghost btn-sm text-success min-h-[44px]"
                              onClick={() => handleSetStatus(p.userId, "CONFIRMED")}
                            >
                              {promoteLabel}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm text-error min-h-[44px]"
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
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Joueur</th>
                        {canEdit && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {table.participants
                        .filter((p) => p.status === "WAITLIST")
                        .map((p) => (
                          <tr key={p.userId}>
                            <td>{p.username}</td>
                            {canEdit && (
                              <td>
                                <div className="flex gap-1">
                                  <button
                                    className="btn btn-ghost btn-xs text-success"
                                    onClick={() => handleSetStatus(p.userId, "CONFIRMED")}
                                  >
                                    {promoteLabel}
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-xs text-error"
                                    onClick={() => handleKick(p.userId, p.username)}
                                  >
                                    Retirer
                                  </button>
                                </div>
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
        )}
      </div>

      {/* Sticky action bar on mobile */}
      <div className="sticky bottom-20 mt-4 flex gap-2 md:static md:mt-6 md:bottom-auto">
        {!isGM && !currentParticipant && (
          <button className="btn btn-primary flex-1 md:flex-none md:btn-sm" onClick={handleJoin}>
            Rejoindre
          </button>
        )}
        {currentParticipant && (
          <button
            className="btn btn-outline btn-warning flex-1 md:flex-none md:btn-sm"
            onClick={handleLeave}
          >
            Quitter
          </button>
        )}
        {canEdit && (
          <>
            <button
              className="btn btn-outline flex-1 md:flex-none md:btn-sm"
              onClick={() => setShowEdit(true)}
            >
              Modifier
            </button>
            <button
              className="btn btn-outline btn-error flex-1 md:flex-none md:btn-sm"
              onClick={handleDelete}
            >
              Supprimer
            </button>
          </>
        )}
      </div>

      <EditTableModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onUpdated={fetchTable}
        eventId={eventId!}
        table={table}
      />
    </div>
  );
}
