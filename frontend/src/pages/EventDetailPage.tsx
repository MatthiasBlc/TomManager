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
import MyPlanningSection from "../components/planning/MyPlanningSection";
import KitchenTab from "../components/kitchen/KitchenTab";
import KitchenBoard from "../components/kitchen/KitchenBoard";
import CoursesTab from "../components/courses/CoursesTab";
import ResponsiveModal from "../components/common/ResponsiveModal";
import AdminBoardGamePanel from "../components/admin/AdminBoardGamePanel";
import { useAdminRights } from "../hooks/useAdminRights";
import { usePageTitle } from "../hooks/usePageTitle";
import { useKitchenData } from "../hooks/useKitchenData";
import { SkeletonEventDetail } from "../components/common/Skeleton";
import { formatParisDateTime } from "../utils/dateTime";
import {
  PencilIcon,
  TrashIcon,
  GridIcon,
  InfoCircleIcon,
  CalendarIcon,
  DiceIcon,
  UsersIcon,
  UtensilsIcon,
  ShoppingCartIcon,
} from "../components/common/icons";

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

type Tab = "info" | "participants" | "planning" | "games" | "kitchen" | "courses";

const VALID_TABS: Tab[] = ["info", "participants", "planning", "games", "kitchen", "courses"];

// Onglets d'evenement en trait souligne (maquette) : filet actif en accent,
// -mb-px pour que ce trait fusionne avec la bordure du conteneur.
const eventTabClass = (active: boolean) =>
  `flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
    active
      ? "border-primary font-semibold text-base-content"
      : "border-transparent text-base-content/60 hover:text-base-content"
  }`;

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
  const { isAdmin, canManageEvents, gameDbEnabled, canManageCourses } = useAdminRights();

  // Fetch + temps reel cuisine partages entre l'onglet Infos et l'onglet Cuisine
  // (evite un double GET /kitchen) ; sert aussi a decider si l'onglet "Cuisine"
  // doit apparaitre dans la nav (point 10 : un USER classique ne doit jamais le
  // voir).
  const kitchen = useKitchenData(eventId);
  const canSeeKitchenTab =
    isAdmin || kitchen.data?.currentUserKitchenRole === "manager" || !!kitchen.data?.isChef;
  // Onglet Courses : droit admin opt-in "Gestion courses" OU appartenance a
  // l'equipe courses de cet event. `admin.kitchen` ne donne rien ici (regle unique,
  // cf docs/features/KitchenCourses).
  const canSeeCoursesTab = canManageCourses || !!kitchen.data?.isCoursesMember;

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
      className={`mx-auto w-full px-4 2xl:max-w-[1400px] ${
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
            {gameDbEnabled && (
              <button
                className="btn btn-outline btn-sm gap-1.5"
                onClick={() => setShowGameDb(true)}
              >
                <GridIcon className="w-3.5 h-3.5" />
                Banque de jeux
              </button>
            )}
            <button className="btn btn-outline btn-sm gap-1.5" onClick={() => setShowEdit(true)}>
              <PencilIcon className="w-3.5 h-3.5" />
              Modifier
            </button>
            <button className="btn btn-outline btn-error btn-sm gap-1.5" onClick={handleDelete}>
              <TrashIcon className="w-3.5 h-3.5" />
              Supprimer
            </button>
          </div>
        )}
      </div>

      <div className="relative mb-4 md:mb-6 flex-none">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-1 border-b border-base-300 min-w-max">
            <button className={eventTabClass(tab === "info")} onClick={() => setTab("info")}>
              <InfoCircleIcon className="w-3.5 h-3.5" />
              Infos
            </button>
            <button
              className={eventTabClass(tab === "planning")}
              onClick={() => setTab("planning")}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Planning
            </button>
            <button className={eventTabClass(tab === "games")} onClick={() => setTab("games")}>
              <DiceIcon className="w-3.5 h-3.5" />
              Jeux de société
            </button>
            <button
              className={eventTabClass(tab === "participants")}
              onClick={() => setTab("participants")}
            >
              <UsersIcon className="w-3.5 h-3.5" />
              Participants ({event.participants.length})
            </button>
            {canSeeKitchenTab && (
              <button
                className={eventTabClass(tab === "kitchen")}
                onClick={() => setTab("kitchen")}
              >
                <UtensilsIcon className="w-3.5 h-3.5" />
                Cuisine
              </button>
            )}
            {canSeeCoursesTab && (
              <button
                className={eventTabClass(tab === "courses")}
                onClick={() => setTab("courses")}
              >
                <ShoppingCartIcon className="w-3.5 h-3.5" />
                Courses
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
            <KitchenBoard
              eventId={event.id}
              data={kitchen.data}
              assistantSwaps={kitchen.assistantSwaps}
              loading={kitchen.loading}
              onChanged={kitchen.refetchAll}
            />
            <MyPlanningSection eventId={event.id} />
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

        {tab === "courses" && canSeeCoursesTab && <CoursesTab eventId={event.id} />}

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
