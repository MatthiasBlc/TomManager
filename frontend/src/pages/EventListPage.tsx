import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../config/api";
import { useAuth } from "../contexts/AuthContext";
import CreateEventModal from "../components/events/CreateEventModal";

interface EventSummary {
  id: string;
  name: string;
  startDateTime: string;
  endDateTime: string;
  participantCount: number;
}

export default function EventListPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get("/api/events");
      setEvents(res.data.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Events</h1>
        {user?.role === "ADMIN" && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            Create Event
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 text-base-content/60">
          <p className="text-lg">No events yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="card-body">
                <h2 className="card-title">{event.name}</h2>
                <p className="text-sm opacity-70">
                  {formatDate(event.startDateTime)} - {formatDate(event.endDateTime)}
                </p>
                <div className="badge badge-outline">
                  {event.participantCount} participant{event.participantCount !== 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateEventModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchEvents}
      />
    </div>
  );
}
