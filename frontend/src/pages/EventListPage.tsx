import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import { useAdminRights } from "../hooks/useAdminRights";
import { useIsMobile } from "../hooks/useIsMobile";
import CreateEventModal from "../components/events/CreateEventModal";
import FAB from "../components/common/FAB";
import { SkeletonCardGrid } from "../components/common/Skeleton";
import EmptyState from "../components/common/EmptyState";

interface EventSummary {
  id: string;
  name: string;
  startDateTime: string;
  endDateTime: string;
  participantCount: number;
}

export default function EventListPage() {
  const { canManageEvents } = useAdminRights();
  const isMobile = useIsMobile();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get("/api/events");
      setEvents(res.data.data);
      setError(false);
    } catch {
      setError(true);
      toast.error("Échec du chargement des événements");
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

  return (
    <div className="container mx-auto px-4 py-4 md:py-8">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-xl font-bold md:text-2xl">Événements</h1>
        {canManageEvents && !isMobile && (
          <button
            className="btn btn-primary active:scale-95 transition-transform"
            onClick={() => setShowCreate(true)}
          >
            Créer un événement
          </button>
        )}
      </div>

      {loading ? (
        <SkeletonCardGrid count={3} />
      ) : error ? (
        <EmptyState
          icon={<span>⚠️</span>}
          title="Échec du chargement des événements"
          description="Vérifiez votre connexion et réessayez."
          action={
            <button className="btn btn-sm" onClick={fetchEvents}>
              Réessayer
            </button>
          }
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<span>📅</span>}
          title="Aucun événement pour l'instant"
          description={
            canManageEvents ? "Créez votre premier événement pour commencer." : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 animate-fade-in">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="card bg-base-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
            >
              <div className="card-body p-4 md:p-6">
                <h2 className="card-title text-base md:text-lg">{event.name}</h2>
                <p className="text-xs opacity-70 md:text-sm">
                  {formatDate(event.startDateTime)} - {formatDate(event.endDateTime)}
                </p>
                <div className="badge badge-outline text-xs">
                  {event.participantCount} participant
                  {event.participantCount !== 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {canManageEvents && isMobile && (
        <FAB onClick={() => setShowCreate(true)} label="Créer un événement" />
      )}

      <CreateEventModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchEvents}
      />
    </div>
  );
}
