import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import { useAuth } from "../contexts/AuthContext";
import EditEventModal from "../components/events/EditEventModal";
import ParticipantList from "../components/events/ParticipantList";
import InvitationManager from "../components/events/InvitationManager";
import BoardGameTab from "../components/boardgames/BoardGameTab";

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

type Tab = "info" | "participants" | "invitations" | "planning" | "games";

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("info");
  const [showEdit, setShowEdit] = useState(false);

  const isCreator = user?.id === event?.createdBy;

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
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-sm opacity-70 mt-1">
            {formatDate(event.startDateTime)} - {formatDate(event.endDateTime)}
          </p>
        </div>
        {isCreator && (
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>
              Edit
            </button>
            <button className="btn btn-outline btn-error btn-sm" onClick={handleDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="tabs tabs-boxed mb-6">
        <button
          className={`tab ${tab === "info" ? "tab-active" : ""}`}
          onClick={() => setTab("info")}
        >
          Info
        </button>
        <button
          className={`tab ${tab === "planning" ? "tab-active" : ""}`}
          onClick={() => navigate(`/events/${eventId}/planning`)}
        >
          Planning
        </button>
        <button
          className={`tab ${tab === "games" ? "tab-active" : ""}`}
          onClick={() => setTab("games")}
        >
          Games
        </button>
        <button
          className={`tab ${tab === "participants" ? "tab-active" : ""}`}
          onClick={() => setTab("participants")}
        >
          Participants ({event.participants.length})
        </button>
        {isCreator && (
          <button
            className={`tab ${tab === "invitations" ? "tab-active" : ""}`}
            onClick={() => setTab("invitations")}
          >
            Invitations
          </button>
        )}
      </div>

      {tab === "info" && (
        <div className="card bg-base-100 shadow-md">
          <div className="card-body">
            <h2 className="card-title">{event.name}</h2>
            <div className="space-y-2">
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
            // If user left, they'll get redirected by fetchEvent error handler
          }}
        />
      )}

      {tab === "invitations" && isCreator && (
        <InvitationManager eventId={event.id} />
      )}

      {tab === "games" && <BoardGameTab eventId={event.id} />}

      <EditEventModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onUpdated={fetchEvent}
        event={event}
      />
    </div>
  );
}
