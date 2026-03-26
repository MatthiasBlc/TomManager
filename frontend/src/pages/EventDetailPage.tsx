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
    <div className="container mx-auto px-4 py-4 md:py-8">
      <div className="flex items-start justify-between mb-4 md:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold truncate md:text-2xl">{event.name}</h1>
          <p className="text-xs opacity-70 mt-1 md:text-sm">
            {formatDate(event.startDateTime)} - {formatDate(event.endDateTime)}
          </p>
        </div>
        {isCreator && (
          <div className="flex gap-2 ml-2 shrink-0">
            <button className="btn btn-outline btn-sm btn-square md:btn-wide" onClick={() => setShowEdit(true)} aria-label="Edit event">
              <span className="hidden md:inline">Edit</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button className="btn btn-outline btn-error btn-sm btn-square md:btn-wide" onClick={handleDelete} aria-label="Delete event">
              <span className="hidden md:inline">Delete</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto -mx-4 px-4 mb-4 md:mb-6 md:mx-0 md:px-0">
        <div className="tabs tabs-boxed inline-flex min-w-max">
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
      </div>

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
