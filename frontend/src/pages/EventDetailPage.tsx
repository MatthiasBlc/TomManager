import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import { useAuth } from "../contexts/AuthContext";
import { useIsMobile } from "../hooks/useIsMobile";
import EditEventModal from "../components/events/EditEventModal";
import ParticipantList from "../components/events/ParticipantList";
import BoardGameTab from "../components/boardgames/BoardGameTab";
import PlanningTab from "../components/planning/PlanningTab";
import ResponsiveModal from "../components/common/ResponsiveModal";
import AdminBoardGamePanel from "../components/admin/AdminBoardGamePanel";
import { useGameDbManagement } from "../hooks/useGameDbManagement";

interface EventDetail {
  id: string;
  name: string;
  startDateTime: string;
  endDateTime: string;
  createdBy: string;
  participants: {
    userId: string;
    username: string;
    role: string;
    joinedAt: string;
  }[];
}

type Tab = "info" | "participants" | "planning" | "games";

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("info");
  const [showEdit, setShowEdit] = useState(false);
  const [showGameDb, setShowGameDb] = useState(false);

  const isMobile = useIsMobile();
  const isCreator = user?.id === event?.createdBy;
  const isAdmin = user?.role === "ADMIN";
  const { gameDbEnabled } = useGameDbManagement();
  const canManageEvent = isCreator || isAdmin;

  const fetchEvent = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}`);
      setEvent(res.data.data);
    } catch {
      toast.error("Failed to load event");
      navigate("/events");
    } finally {
      setLoading(false);
    }
  }, [eventId, navigate]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleDelete = async () => {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    try {
      await api.delete(`/api/events/${eventId}`);
      toast.success("Event deleted");
      navigate("/events");
    } catch {
      toast.error("Failed to delete event");
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!event) return null;

  return (
    <div
      className={`container mx-auto px-4 ${
        tab === "planning" && !isMobile
          ? "pt-4 md:pt-6 h-[calc(100dvh-4rem)] flex flex-col"
          : "py-4 md:py-8"
      }`}
    >
      <div className="flex items-start justify-between mb-4 md:mb-6 flex-none">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold truncate md:text-2xl">{event.name}</h1>
          <p className="text-xs opacity-70 mt-1 md:text-sm">
            {formatDate(event.startDateTime)} - {formatDate(event.endDateTime)}
          </p>
        </div>
        {canManageEvent && (
          <div className="flex flex-wrap gap-2 ml-2 shrink-0">
            <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>
              Edit
            </button>
            <button className="btn btn-outline btn-error btn-sm" onClick={handleDelete}>
              Delete
            </button>
            {isAdmin && gameDbEnabled && (
              <button className="btn btn-outline btn-sm" onClick={() => setShowGameDb(true)}>
                Manage game database
              </button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto -mx-4 px-4 mb-4 md:mb-6 md:mx-0 md:px-0 flex-none">
        <div className="tabs tabs-boxed inline-flex min-w-max">
          <button
            className={`tab ${tab === "info" ? "tab-active" : ""}`}
            onClick={() => setTab("info")}
          >
            Info
          </button>
          <button
            className={`tab ${tab === "planning" ? "tab-active" : ""}`}
            onClick={() => setTab("planning")}
          >
            Planning
          </button>
          <button
            className={`tab ${tab === "games" ? "tab-active" : ""}`}
            onClick={() => setTab("games")}
          >
            Jeux de societe
          </button>
          <button
            className={`tab ${tab === "participants" ? "tab-active" : ""}`}
            onClick={() => setTab("participants")}
          >
            Participants ({event.participants.length})
          </button>
        </div>
      </div>

      <div className={tab === "planning" && !isMobile ? "flex-1 min-h-0" : ""}>
        {tab === "info" && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-4 md:p-6">
              <h2 className="card-title text-base md:text-lg">{event.name}</h2>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Start:</span> {formatDate(event.startDateTime)}
                </p>
                <p>
                  <span className="font-medium">End:</span> {formatDate(event.endDateTime)}
                </p>
                <p>
                  <span className="font-medium">Participants:</span> {event.participants.length}
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === "participants" && (
          <ParticipantList
            eventId={event.id}
            createdBy={event.createdBy}
            participants={event.participants}
            onChanged={() => {
              fetchEvent();
            }}
          />
        )}

        {tab === "planning" && <PlanningTab eventId={event.id} />}

        {tab === "games" && <BoardGameTab eventId={event.id} />}
      </div>

      <EditEventModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onUpdated={fetchEvent}
        event={event}
      />

      <ResponsiveModal
        open={showGameDb}
        onClose={() => setShowGameDb(false)}
        title="Banque de jeux"
        size="xl"
      >
        <div className="mt-4 overflow-y-auto max-h-[70vh]">
          <AdminBoardGamePanel />
        </div>
      </ResponsiveModal>
    </div>
  );
}
