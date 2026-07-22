import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import { useConfirm } from "../contexts/ConfirmContext";
import { useIsMobile } from "../hooks/useIsMobile";
import EditEventModal from "../components/events/EditEventModal";
import ParticipantList from "../components/events/ParticipantList";
import BoardGameTab from "../components/boardgames/BoardGameTab";
import PlanningTab from "../components/planning/PlanningTab";
import KitchenTab from "../components/kitchen/KitchenTab";
import KitchenBoard from "../components/kitchen/KitchenBoard";
import ResponsiveModal from "../components/common/ResponsiveModal";
import AdminBoardGamePanel from "../components/admin/AdminBoardGamePanel";
import { useAdminRights } from "../hooks/useAdminRights";
import { usePageTitle } from "../hooks/usePageTitle";
import { useKitchenData } from "../hooks/useKitchenData";
import { SkeletonEventDetail } from "../components/common/Skeleton";
import { formatParisDateTime } from "../utils/dateTime";

interface EventDetail {
  id: string;
  name: string;
  startDateTime: string;
  endDateTime: string;
  createdBy: string;
  discordRoleId?: string | null;
  participants: {
    userId: string;
    username: string;
    role: string;
    joinedAt: string;
  }[];
}

type Tab = "info" | "participants" | "planning" | "games" | "kitchen";

const VALID_TABS: Tab[] = ["info", "participants", "planning", "games", "kitchen"];

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const confirmDialog = useConfirm();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Onglet actif dans l'URL (?tab=) : survit au refresh et partageable.
  // `replace` : le bouton retour ramene a la liste des events, pas a chaque onglet visite
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") as Tab | null;
  const tab: Tab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : "info";
  const setTab = (next: Tab) => setSearchParams({ tab: next }, { replace: true });
  const [showEdit, setShowEdit] = useState(false);
  const [showGameDb, setShowGameDb] = useState(false);

  usePageTitle(event?.name);

  const isMobile = useIsMobile();
  const { isAdmin, canManageEvents, gameDbEnabled } = useAdminRights();

  // Fetch + temps reel cuisine partages entre l'onglet Infos et l'onglet Cuisine
  // (evite un double GET /kitchen) ; sert aussi a decider si l'onglet "Cuisine"
  // doit apparaitre dans la nav (point 10 : un USER classique ne doit jamais le
  // voir).
  const kitchen = useKitchenData(eventId);
  const canSeeKitchenTab =
    isAdmin || kitchen.data?.currentUserKitchenRole === "manager" || !!kitchen.data?.isChef;

  const fetchEvent = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}`);
      setEvent(res.data.data);
    } catch {
      toast.error("Échec du chargement de l'événement");
      navigate("/events");
    } finally {
      setLoading(false);
    }
  }, [eventId, navigate]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: "Supprimer l'événement",
      message: "Supprimer cet événement ? Cette action est irréversible.",
      confirmLabel: "Supprimer",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/api/events/${eventId}`);
      toast.success("Événement supprimé");
      navigate("/events");
    } catch {
      toast.error("Échec de la suppression de l'événement");
    }
  };

  const formatDate = (iso: string) =>
    formatParisDateTime(iso, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return <SkeletonEventDetail />;
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
      {/* Mobile : titre+date puis actions en dessous ; desktop : cote a cote */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-4 md:mb-6 flex-none">
        <div className="min-w-0 md:flex-1">
          <h1 className="text-lg font-bold truncate md:text-2xl">{event.name}</h1>
          <p className="text-xs opacity-70 mt-1 md:text-sm">
            {formatDate(event.startDateTime)} - {formatDate(event.endDateTime)}
          </p>
        </div>
        {canManageEvents && (
          <div className="flex flex-wrap gap-2 md:ml-2 md:shrink-0 md:justify-end">
            <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>
              Modifier
            </button>
            <button className="btn btn-outline btn-error btn-sm" onClick={handleDelete}>
              Supprimer
            </button>
            {gameDbEnabled && (
              <button className="btn btn-outline btn-sm" onClick={() => setShowGameDb(true)}>
                Gérer la base de jeux
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative mb-4 md:mb-6 flex-none">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="tabs tabs-boxed inline-flex min-w-max">
            <button
              className={`tab ${tab === "info" ? "tab-active" : ""}`}
              onClick={() => setTab("info")}
            >
              Infos
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
              Jeux de société
            </button>
            <button
              className={`tab ${tab === "participants" ? "tab-active" : ""}`}
              onClick={() => setTab("participants")}
            >
              Participants ({event.participants.length})
            </button>
            {canSeeKitchenTab && (
              <button
                className={`tab ${tab === "kitchen" ? "tab-active" : ""}`}
                onClick={() => setTab("kitchen")}
              >
                Cuisine
              </button>
            )}
          </div>
        </div>
        {/* Affordance de scroll : degrade sur le bord droit, mobile uniquement */}
        <div className="pointer-events-none absolute inset-y-0 -right-4 w-10 bg-gradient-to-l from-base-200 to-transparent md:hidden" />
      </div>

      <div className={tab === "planning" && !isMobile ? "flex-1 min-h-0" : ""}>
        {tab === "info" && (
          <div className="space-y-4 md:space-y-6">
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body p-4 md:p-6">
                <h2 className="card-title text-base md:text-lg">{event.name}</h2>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Début :</span> {formatDate(event.startDateTime)}
                  </p>
                  <p>
                    <span className="font-medium">Fin :</span> {formatDate(event.endDateTime)}
                  </p>
                  <p>
                    <span className="font-medium">Participants :</span> {event.participants.length}
                  </p>
                </div>
              </div>
            </div>
            <KitchenBoard
              eventId={event.id}
              data={kitchen.data}
              loading={kitchen.loading}
              onChanged={kitchen.fetchKitchen}
            />
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

        {tab === "kitchen" && (
          <KitchenTab
            eventId={event.id}
            data={kitchen.data}
            swaps={kitchen.swaps}
            loading={kitchen.loading}
            onChanged={kitchen.refetchAll}
          />
        )}
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
        {/* px-4 sur mobile : le MobileSheet ne padde pas son contenu */}
        <div className="mt-4 overflow-y-auto max-h-[70vh] px-4 md:px-0">
          <AdminBoardGamePanel />
        </div>
      </ResponsiveModal>
    </div>
  );
}
