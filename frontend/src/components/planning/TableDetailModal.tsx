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
import BoardGameDetailModal from "../boardgames/BoardGameDetailModal";
import { formatSeatSummary } from "./computeLayout";

interface BoardGameSummary {
  id: string;
  name: string;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playingTime?: number | null;
  imageUrl?: string | null;
  description?: string | null;
  yearPublished?: number | null;
}

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
  boardGame?: BoardGameSummary | null;
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
  const [showBoardGame, setShowBoardGame] = useState(false);
  const [boardGameEntry, setBoardGameEntry] = useState<{
    broughtBy: { id: string; username: string }[];
    linkedTables: { id: string; title: string }[];
  } | null>(null);

  const isGM = user?.id === table?.createdBy;
  const isAdmin = user?.role === "ADMIN";
  const canEdit = isGM || isAdmin;
  const currentParticipant = table?.participants.find((p) => p.userId === user?.id);
  const confirmedCount = table?.participants.filter((p) => p.status === "CONFIRMED").length ?? 0;
  const waitlistCount = table?.participants.filter((p) => p.status === "WAITLIST").length ?? 0;
  const confirmedOnReserved =
    table?.participants.filter((p) => p.status === "CONFIRMED" && p.isOnReservedSeat).length ?? 0;
  const seatSummary = table
    ? formatSeatSummary({
        confirmedCount,
        maxPlayers: table.maxPlayers,
        reservedSeats: table.reservedSeats,
        confirmedOnReserved,
      })
    : null;

  const fetchTable = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/events/${eventId}/tables/${tableId}`);
      setTable(res.data.data);
    } catch {
      toast.error("Echec du chargement de la table");
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
    onReconnected: fetchTable,
  });

  const handleJoin = async () => {
    if (!table) return;
    try {
      const res = await api.post(`/api/events/${eventId}/tables/${table.id}/join`);
      const status = res.data.data.status;
      toast.success(status === "CONFIRMED" ? "Inscrit !" : "Ajoute sur la liste d'attente");
      fetchTable();
      onTableUpdated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Echec de l'inscription";
      toast.error(message);
    }
  };

  const handleLeave = async () => {
    if (!table) return;
    if (!confirm("Quitter cette table ?")) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${table.id}/leave`);
      toast.success("Vous avez quitte la table");
      fetchTable();
      onTableUpdated();
    } catch {
      toast.error("Echec en quittant la table");
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
          ?.message || "Echec lors de l'ajout a la table";
      toast.error(message);
    }
  };

  const handleDemote = async (userId: string) => {
    if (!table) return;
    try {
      await api.patch(`/api/events/${eventId}/tables/${table.id}/participants/${userId}/status`, {
        status: "WAITLIST",
      });
      toast.success("Joueur retrograde");
      fetchTable();
      onTableUpdated();
    } catch {
      toast.error("Echec du passage en liste d'attente");
    }
  };

  const handleKick = async (userId: string, username: string) => {
    if (!table) return;
    if (!confirm(`Retirer ${username} de cette table ?`)) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${table.id}/participants/${userId}`);
      toast.success(`${username} retire de la table`);
      fetchTable();
      onTableUpdated();
    } catch {
      toast.error("Echec du retrait du joueur");
    }
  };

  const handleDelete = async () => {
    if (!table) return;
    if (!confirm("Supprimer cette table ? Cette action est irreversible.")) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${table.id}`);
      toast.success("Table supprimee");
      onTableDeleted();
      onClose();
    } catch {
      toast.error("Echec de la suppression de la table");
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
                {seatSummary && (
                  <span className="badge badge-warning badge-sm">{seatSummary.total}</span>
                )}
                {seatSummary?.normal && (
                  <span className="ml-2 text-xs opacity-70">{seatSummary.normal}</span>
                )}
                {seatSummary?.reserved && (
                  <span className="ml-2 text-xs opacity-70">{seatSummary.reserved}</span>
                )}
                {waitlistCount > 0 && (
                  <span className="ml-2 badge badge-warning badge-xs">
                    +{waitlistCount} en attente
                  </span>
                )}
              </p>
            </div>

            {/* Jeu associe (JDS uniquement) */}
            {table.boardGame && (
              <button
                type="button"
                className="flex items-center gap-3 p-2 bg-base-200 rounded-lg w-full text-left hover:bg-base-300 transition-colors"
                onClick={async () => {
                  if (!table.boardGame) return;
                  try {
                    const res = await api.get(`/api/events/${eventId}/boardgames`);
                    const entries: {
                      boardGame: { id: string };
                      broughtBy: { id: string; username: string };
                      linkedTables: { id: string; title: string }[];
                    }[] = res.data.data;
                    const matching = entries.filter((e) => e.boardGame.id === table.boardGame!.id);
                    setBoardGameEntry({
                      broughtBy: matching.map((e) => e.broughtBy),
                      linkedTables: matching[0]?.linkedTables ?? [],
                    });
                  } catch {
                    setBoardGameEntry({
                      broughtBy: [],
                      linkedTables: [{ id: table.id, title: table.title }],
                    });
                  }
                  setShowBoardGame(true);
                }}
              >
                {table.boardGame.imageUrl && (
                  <img
                    src={table.boardGame.imageUrl}
                    alt={table.boardGame.name}
                    className="w-12 h-12 object-cover rounded shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{table.boardGame.name}</p>
                  <p className="text-xs opacity-60">
                    {[
                      table.boardGame.minPlayers && table.boardGame.maxPlayers
                        ? `${table.boardGame.minPlayers}–${table.boardGame.maxPlayers} joueurs`
                        : table.boardGame.maxPlayers
                          ? `${table.boardGame.maxPlayers} joueurs max`
                          : null,
                      table.boardGame.playingTime ? `${table.boardGame.playingTime} min` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="text-xs opacity-40 shrink-0">→</span>
              </button>
            )}

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

            {/* Participants confirmes */}
            <div className="card bg-base-200 shadow-none">
              <div className="card-body p-3">
                <h4 className="font-semibold text-sm mb-2">
                  Participants ({confirmedCount}/{table.maxPlayers})
                </h4>
                {confirmedCount === 0 ? (
                  <EmptyState icon={<span>👥</span>} title="Aucun participant pour l'instant" />
                ) : isMobile ? (
                  <div className="space-y-1">
                    {table.participants
                      .filter((p) => p.status === "CONFIRMED")
                      .map((p) => (
                        <div key={p.userId} className="flex items-center justify-between py-1">
                          <span className="text-sm">{p.username}</span>
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <button
                                className="btn btn-ghost btn-xs text-warning min-h-[44px]"
                                onClick={() => handleDemote(p.userId)}
                              >
                                Mettre sur liste d'attente
                              </button>
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
                          {canEdit && <th />}
                        </tr>
                      </thead>
                      <tbody>
                        {table.participants
                          .filter((p) => p.status === "CONFIRMED")
                          .map((p) => (
                            <tr key={p.userId}>
                              <td>{p.username}</td>
                              {canEdit && (
                                <td className="flex gap-1">
                                  <button
                                    className="btn btn-ghost btn-xs text-warning"
                                    onClick={() => handleDemote(p.userId)}
                                  >
                                    Mettre sur liste d'attente
                                  </button>
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

            {/* Waitlist */}
            {waitlistCount > 0 && (
              <div className="card bg-base-200 border-l-4 border-warning shadow-none">
                <div className="card-body p-3">
                  <h4 className="font-semibold text-sm mb-2">Liste d'attente ({waitlistCount})</h4>
                  {isMobile ? (
                    <div className="space-y-1">
                      {table.participants
                        .filter((p) => p.status === "WAITLIST")
                        .map((p) => (
                          <div key={p.userId} className="flex items-center justify-between py-1">
                            <span className="text-sm">{p.username}</span>
                            {canEdit && (
                              <div className="flex items-center gap-1">
                                <button
                                  className="btn btn-ghost btn-xs text-success min-h-[44px]"
                                  onClick={() => handlePromote(p.userId)}
                                  disabled={confirmedCount >= table.maxPlayers}
                                  title={
                                    confirmedCount >= table.maxPlayers
                                      ? "Table pleine — retrogradez un joueur d'abord"
                                      : "Ajouter a la table"
                                  }
                                >
                                  Ajouter a la table
                                </button>
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
                            {canEdit && <th />}
                          </tr>
                        </thead>
                        <tbody>
                          {table.participants
                            .filter((p) => p.status === "WAITLIST")
                            .map((p) => (
                              <tr key={p.userId}>
                                <td>{p.username}</td>
                                {canEdit && (
                                  <td className="flex gap-1">
                                    <button
                                      className="btn btn-ghost btn-xs text-success"
                                      onClick={() => handlePromote(p.userId)}
                                      disabled={confirmedCount >= table.maxPlayers}
                                      title={
                                        confirmedCount >= table.maxPlayers
                                          ? "Table pleine — retrogradez un joueur d'abord"
                                          : "Ajouter a la table"
                                      }
                                    >
                                      Ajouter a la table
                                    </button>
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
            )}

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

      {table?.boardGame && (
        <BoardGameDetailModal
          open={showBoardGame}
          onClose={() => setShowBoardGame(false)}
          game={table.boardGame}
          linkedTables={boardGameEntry?.linkedTables ?? []}
          broughtBy={boardGameEntry?.broughtBy ?? []}
        />
      )}
    </>
  );
}
