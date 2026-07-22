import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useConfirm } from "../../contexts/ConfirmContext";
import { useAdminRights } from "../../hooks/useAdminRights";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useEventSocket } from "../../hooks/useEventSocket";
import ResponsiveModal from "../common/ResponsiveModal";
import EditTableModal from "./EditTableModal";
import EmptyState from "../common/EmptyState";
import { SkeletonTableDetail } from "../common/Skeleton";
import BoardGameDetailModal from "../boardgames/BoardGameDetailModal";
import { formatSeatSummary } from "./computeLayout";
import { getErrorMessage } from "../../config/apiErrors";
import { formatParisDateTime } from "../../utils/dateTime";

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
  creator: { id: string; username: string; displayName?: string | null };
  tags: { id: string; name: string }[];
  participants: {
    userId: string;
    username: string;
    displayName?: string | null;
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
  const confirmDialog = useConfirm();
  const { canModerateTables } = useAdminRights();
  const isMobile = useIsMobile();
  const [table, setTable] = useState<TableDetail | null>(null);
  const [loading, setLoading] = useState(false);
  // Identifiant de l'action async en cours (join, leave, delete, promote:<id>...) :
  // tous les boutons d'action sont desactives tant qu'une requete est en vol
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showBoardGame, setShowBoardGame] = useState(false);
  const [boardGameEntry, setBoardGameEntry] = useState<{
    broughtBy: { id: string; username: string }[];
    linkedTables: { id: string; title: string }[];
  } | null>(null);

  const isGM = user?.id === table?.createdBy;
  const canEdit = isGM || canModerateTables;
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
  // Places libres = capacite libre (maxPlayers - reservedSeats) moins les confirmes
  // sur place libre uniquement (les occupants de places reservees ne comptent pas ici)
  const openNormalSeats = table
    ? table.maxPlayers - table.reservedSeats - (confirmedCount - confirmedOnReserved)
    : 0;
  const canPromoteFree = openNormalSeats > 0;
  const canPromoteReserved = (table?.reservedSeats ?? 0) - confirmedOnReserved > 0;

  const fetchTable = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/events/${eventId}/tables/${tableId}`);
      setTable(res.data.data);
    } catch {
      toast.error("Échec du chargement de la table");
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
    if (!table || pendingAction) return;
    setPendingAction("join");
    try {
      const res = await api.post(`/api/events/${eventId}/tables/${table.id}/join`);
      const status = res.data.data.status;
      toast.success(status === "CONFIRMED" ? "Inscrit !" : "Ajouté sur la liste d'attente");
      fetchTable();
      onTableUpdated();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec de l'inscription"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleLeave = async () => {
    if (!table || pendingAction) return;
    const ok = await confirmDialog({
      title: isGM ? "Supprimer la table" : "Quitter la table",
      message: isGM
        ? "Quitter votre propre table la supprime. Cette action est irréversible."
        : "Quitter cette table ?",
      confirmLabel: isGM ? "Supprimer" : "Quitter",
      variant: isGM ? "danger" : "warning",
    });
    if (!ok) return;
    setPendingAction("leave");
    try {
      await api.delete(`/api/events/${eventId}/tables/${table.id}/leave`);
      toast.success("Vous avez quitté la table");
      fetchTable();
      onTableUpdated();
    } catch {
      toast.error("Échec en quittant la table");
    } finally {
      setPendingAction(null);
    }
  };

  const handlePromote = async (
    userId: string,
    seat?: "FREE" | "RESERVED",
    successMessage = "Joueur promu"
  ) => {
    if (!table || pendingAction) return;
    setPendingAction(`promote:${userId}`);
    try {
      await api.patch(`/api/events/${eventId}/tables/${table.id}/participants/${userId}/status`, {
        status: "CONFIRMED",
        ...(seat ? { seat } : {}),
      });
      toast.success(successMessage);
      fetchTable();
      onTableUpdated();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Échec lors de l'ajout à la table"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleDemote = async (userId: string) => {
    if (!table || pendingAction) return;
    setPendingAction(`demote:${userId}`);
    try {
      await api.patch(`/api/events/${eventId}/tables/${table.id}/participants/${userId}/status`, {
        status: "WAITLIST",
      });
      toast.success("Joueur rétrogradé");
      fetchTable();
      onTableUpdated();
    } catch {
      toast.error("Échec du passage en liste d'attente");
    } finally {
      setPendingAction(null);
    }
  };

  const promoteSpinner = (userId: string) =>
    pendingAction === `promote:${userId}` && (
      <span className="loading loading-spinner loading-xs" />
    );

  const renderPromoteActions = (userId: string, btnClass: string) => {
    if (canPromoteFree && canPromoteReserved) {
      return (
        <>
          <button
            className={btnClass}
            disabled={!!pendingAction}
            onClick={() => handlePromote(userId, "FREE")}
          >
            {promoteSpinner(userId)}
            Ajouter (place libre)
          </button>
          <button
            className={btnClass}
            disabled={!!pendingAction}
            onClick={() => handlePromote(userId, "RESERVED")}
          >
            {promoteSpinner(userId)}
            Affecter (place réservée)
          </button>
        </>
      );
    }
    if (canPromoteFree) {
      return (
        <button
          className={btnClass}
          disabled={!!pendingAction}
          onClick={() => handlePromote(userId, "FREE")}
        >
          {promoteSpinner(userId)}
          Ajouter à la table
        </button>
      );
    }
    if (canPromoteReserved) {
      return (
        <button
          className={btnClass}
          disabled={!!pendingAction}
          onClick={() => handlePromote(userId, "RESERVED")}
        >
          {promoteSpinner(userId)}
          Affecter (place réservée)
        </button>
      );
    }
    return (
      <button className={btnClass} disabled title="Table pleine — rétrogradez un joueur d'abord">
        Aucune place disponible
      </button>
    );
  };

  const renderConvertSeatAction = (
    p: { userId: string; isOnReservedSeat: boolean },
    btnClass: string
  ) => {
    if (p.isOnReservedSeat) {
      // Liberer une place reservee exige une place libre disponible (meme regle
      // que le backend), sinon le compartiment libre deborderait
      if (!canPromoteFree) return null;
      return (
        <button
          className={btnClass}
          disabled={!!pendingAction}
          onClick={() => handlePromote(p.userId, "FREE", "Place libérée")}
        >
          {promoteSpinner(p.userId)}
          Passer en place libre
        </button>
      );
    }
    if (canPromoteReserved) {
      return (
        <button
          className={btnClass}
          disabled={!!pendingAction}
          onClick={() => handlePromote(p.userId, "RESERVED", "Place réservée attribuée")}
        >
          {promoteSpinner(p.userId)}
          Passer en place réservée
        </button>
      );
    }
    return null;
  };

  const handleKick = async (userId: string, displayedName: string) => {
    if (!table || pendingAction) return;
    const ok = await confirmDialog({
      title: "Retirer le joueur",
      message: `Retirer ${displayedName} de cette table ?`,
      confirmLabel: "Retirer",
      variant: "danger",
    });
    if (!ok) return;
    setPendingAction(`kick:${userId}`);
    try {
      await api.delete(`/api/events/${eventId}/tables/${table.id}/participants/${userId}`);
      toast.success(`${displayedName} retiré de la table`);
      fetchTable();
      onTableUpdated();
    } catch {
      toast.error("Échec du retrait du joueur");
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!table || pendingAction) return;
    const ok = await confirmDialog({
      title: "Supprimer la table",
      message: "Supprimer cette table ? Cette action est irréversible.",
      confirmLabel: "Supprimer",
      variant: "danger",
    });
    if (!ok) return;
    setPendingAction("delete");
    try {
      await api.delete(`/api/events/${eventId}/tables/${table.id}`);
      toast.success("Table supprimée");
      onTableDeleted();
      onClose();
    } catch {
      toast.error("Échec de la suppression de la table");
    } finally {
      setPendingAction(null);
    }
  };

  const displayedName = (p: { username: string; displayName?: string | null }) =>
    p.displayName ?? p.username;

  const formatDateTime = (iso: string) =>
    formatParisDateTime(iso, {
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
                {table.type === "JDR" ? "MJ" : "Créateur"} : {displayedName(table.creator)}
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
                      broughtBy: { id: string; username: string; displayName?: string | null };
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
                  <div className="divide-y divide-base-300">
                    {/* Nom sur sa ligne, actions wrappables en dessous : 3 actions
                        textuelles ne tiennent pas cote a cote sur 390px */}
                    {table.participants
                      .filter((p) => p.status === "CONFIRMED")
                      .map((p) => (
                        <div key={p.userId} className="py-1.5">
                          <span className="text-sm flex items-center gap-1.5">
                            {displayedName(p)}
                            {p.isOnReservedSeat && (
                              <span className="badge badge-warning badge-xs">réservée</span>
                            )}
                          </span>
                          {/* Aucune action sur la ligne du MJ : jamais de place reservee,
                              jamais de waitlist, il quitte via la suppression de table */}
                          {canEdit && p.userId !== table.createdBy && (
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              {renderConvertSeatAction(p, "btn btn-ghost btn-xs min-h-[44px]")}
                              <button
                                className="btn btn-ghost btn-xs text-warning min-h-[44px]"
                                disabled={!!pendingAction}
                                onClick={() => handleDemote(p.userId)}
                              >
                                {pendingAction === `demote:${p.userId}` && (
                                  <span className="loading loading-spinner loading-xs" />
                                )}
                                Mettre sur liste d'attente
                              </button>
                              <button
                                className="btn btn-ghost btn-xs text-error min-h-[44px]"
                                disabled={!!pendingAction}
                                onClick={() => handleKick(p.userId, displayedName(p))}
                              >
                                {pendingAction === `kick:${p.userId}` && (
                                  <span className="loading loading-spinner loading-xs" />
                                )}
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
                              <td>
                                <span className="flex items-center gap-1.5">
                                  {displayedName(p)}
                                  {p.isOnReservedSeat && (
                                    <span className="badge badge-warning badge-xs">réservée</span>
                                  )}
                                </span>
                              </td>
                              {canEdit && (
                                <td className="flex gap-1">
                                  {/* Aucune action sur la ligne du MJ : jamais de place reservee,
                                      jamais de waitlist, il quitte via la suppression de table */}
                                  {p.userId !== table.createdBy && (
                                    <>
                                      {renderConvertSeatAction(p, "btn btn-ghost btn-xs")}
                                      <button
                                        className="btn btn-ghost btn-xs text-warning"
                                        disabled={!!pendingAction}
                                        onClick={() => handleDemote(p.userId)}
                                      >
                                        {pendingAction === `demote:${p.userId}` && (
                                          <span className="loading loading-spinner loading-xs" />
                                        )}
                                        Mettre sur liste d'attente
                                      </button>
                                      <button
                                        className="btn btn-ghost btn-xs text-error"
                                        disabled={!!pendingAction}
                                        onClick={() => handleKick(p.userId, displayedName(p))}
                                      >
                                        {pendingAction === `kick:${p.userId}` && (
                                          <span className="loading loading-spinner loading-xs" />
                                        )}
                                        Retirer
                                      </button>
                                    </>
                                  )}
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
                    <div className="divide-y divide-base-300">
                      {table.participants
                        .filter((p) => p.status === "WAITLIST")
                        .map((p) => (
                          <div key={p.userId} className="py-1.5">
                            <span className="text-sm">{displayedName(p)}</span>
                            {canEdit && (
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {renderPromoteActions(
                                  p.userId,
                                  "btn btn-ghost btn-xs text-success min-h-[44px]"
                                )}
                                {p.userId !== table.createdBy && (
                                  <button
                                    className="btn btn-ghost btn-xs text-error min-h-[44px]"
                                    disabled={!!pendingAction}
                                    onClick={() => handleKick(p.userId, displayedName(p))}
                                  >
                                    {pendingAction === `kick:${p.userId}` && (
                                      <span className="loading loading-spinner loading-xs" />
                                    )}
                                    Retirer
                                  </button>
                                )}
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
                                <td>{displayedName(p)}</td>
                                {canEdit && (
                                  <td className="flex gap-1">
                                    {renderPromoteActions(
                                      p.userId,
                                      "btn btn-ghost btn-xs text-success"
                                    )}
                                    {p.userId !== table.createdBy && (
                                      <button
                                        className="btn btn-ghost btn-xs text-error"
                                        disabled={!!pendingAction}
                                        onClick={() => handleKick(p.userId, displayedName(p))}
                                      >
                                        {pendingAction === `kick:${p.userId}` && (
                                          <span className="loading loading-spinner loading-xs" />
                                        )}
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
                </div>
              </div>
            )}

            {/* Actions */}
            <div className={`flex flex-wrap gap-2 pt-1 ${isMobile ? "pb-2" : ""}`}>
              {!currentParticipant && (!isGM || table.type === "JDS" || table.gmIsPlayer) && (
                <button
                  className="btn btn-primary btn-sm flex-1 md:flex-none"
                  disabled={!!pendingAction}
                  onClick={handleJoin}
                >
                  {pendingAction === "join" && (
                    <span className="loading loading-spinner loading-xs" />
                  )}
                  {openNormalSeats <= 0 ? "Rejoindre la liste d'attente" : "Rejoindre"}
                </button>
              )}
              {currentParticipant && (
                <button
                  className="btn btn-outline btn-warning btn-sm flex-1 md:flex-none"
                  disabled={!!pendingAction}
                  onClick={handleLeave}
                >
                  {pendingAction === "leave" && (
                    <span className="loading loading-spinner loading-xs" />
                  )}
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
                    disabled={!!pendingAction}
                    onClick={handleDelete}
                  >
                    {pendingAction === "delete" && (
                      <span className="loading loading-spinner loading-xs" />
                    )}
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
