import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import { useAuth } from "../contexts/AuthContext";
import { useIsMobile } from "../hooks/useIsMobile";
import EditTableModal from "../components/planning/EditTableModal";
import { useEventSocket } from "../hooks/useEventSocket";

interface TableDetail {
  id: string;
  eventId: string;
  createdBy: string;
  title: string;
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

export default function TableDetailPage() {
  const { eventId, tableId } = useParams<{ eventId: string; tableId: string }>();
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

  const fetchTable = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/tables/${tableId}`);
      setTable(res.data.data);
    } catch {
      toast.error("Failed to load table");
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
      toast.success(status === "CONFIRMED" ? "Joined!" : "Added to waitlist");
      fetchTable();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to join";
      toast.error(message);
    }
  };

  const handleLeave = async () => {
    if (!confirm("Leave this table?")) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${tableId}/leave`);
      toast.success("Left table");
      fetchTable();
    } catch {
      toast.error("Failed to leave table");
    }
  };

  const handleKick = async (userId: string, username: string) => {
    if (!confirm(`Remove ${username} from this table?`)) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${tableId}/participants/${userId}`);
      toast.success(`${username} removed`);
      fetchTable();
    } catch {
      toast.error("Failed to remove player");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this table? This cannot be undone.")) return;
    try {
      await api.delete(`/api/events/${eventId}/tables/${tableId}`);
      toast.success("Table deleted");
      navigate(`/events/${eventId}/planning`);
    } catch {
      toast.error("Failed to delete table");
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
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!table) return null;

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-3xl">
      {!isMobile && (
        <button
          className="btn btn-ghost btn-sm mb-4"
          onClick={() => navigate(`/events/${eventId}/planning`)}
        >
          &larr; Back to planning
        </button>
      )}

      <div className="mb-4 md:mb-6">
        <h1 className="text-lg font-bold md:text-2xl">{table.title}</h1>
        <p className="text-xs opacity-70 mt-1 md:text-sm">
          GM: {table.creator.username}
        </p>
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
              <h3 className="font-semibold text-sm">Comments</h3>
              <p className="whitespace-pre-wrap text-sm">{table.comments}</p>
            </div>
          </div>
        )}

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-3 md:p-4">
            <h3 className="font-semibold text-sm mb-2">
              Participants ({confirmedCount}/{table.maxPlayers})
              {table.participants.filter((p) => p.status === "WAITLIST").length > 0 && (
                <span className="badge badge-warning badge-sm ml-2">
                  +{table.participants.filter((p) => p.status === "WAITLIST").length} waitlist
                </span>
              )}
            </h3>
            {table.participants.length === 0 ? (
              <p className="text-sm opacity-60">No participants yet</p>
            ) : isMobile ? (
              <div className="space-y-2">
                {table.participants.map((p) => (
                  <div key={p.userId} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.username}</span>
                      <span
                        className={`badge badge-sm ${
                          p.status === "CONFIRMED" ? "badge-success" : "badge-warning"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        className="btn btn-ghost btn-sm text-error min-h-[44px]"
                        onClick={() => handleKick(p.userId, p.username)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Status</th>
                      {canEdit && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {table.participants.map((p) => (
                      <tr key={p.userId}>
                        <td>{p.username}</td>
                        <td>
                          <span
                            className={`badge badge-sm ${
                              p.status === "CONFIRMED" ? "badge-success" : "badge-warning"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        {canEdit && (
                          <td>
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() => handleKick(p.userId, p.username)}
                            >
                              Remove
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
      </div>

      {/* Sticky action bar on mobile */}
      <div className="sticky bottom-20 mt-4 flex gap-2 md:static md:mt-6 md:bottom-auto">
        {!isGM && !currentParticipant && (
          <button className="btn btn-primary flex-1 md:flex-none md:btn-sm" onClick={handleJoin}>
            Join
          </button>
        )}
        {currentParticipant && (
          <button className="btn btn-outline btn-warning flex-1 md:flex-none md:btn-sm" onClick={handleLeave}>
            Leave
          </button>
        )}
        {canEdit && (
          <>
            <button className="btn btn-outline flex-1 md:flex-none md:btn-sm" onClick={() => setShowEdit(true)}>
              Edit
            </button>
            <button className="btn btn-outline btn-error flex-1 md:flex-none md:btn-sm" onClick={handleDelete}>
              Delete
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
