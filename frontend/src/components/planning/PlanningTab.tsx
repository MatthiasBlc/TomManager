import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAdminRights } from "../../hooks/useAdminRights";
import TimelineView from "./TimelineView";
import CalendarView from "./CalendarView";
import CreateTableModal from "./CreateTableModal";
import TableDetailModal from "./TableDetailModal";
import FAB from "../common/FAB";
import { useEventSocket } from "../../hooks/useEventSocket";
import { SkeletonCardGrid } from "../common/Skeleton";
import { type TableSummary } from "./computeLayout";

interface EventBounds {
  startDateTime: string;
  endDateTime: string;
}

type ViewMode = "list" | "calendar";
const VIEW_PREF_KEY = "planning_view_preference";

function getStoredView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_PREF_KEY);
    return v === "calendar" ? "calendar" : "list";
  } catch {
    return "list";
  }
}

export default function PlanningTab({ eventId }: { eventId: string }) {
  const isMobile = useIsMobile();
  const { pdfExportEnabled } = useAdminRights();
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [eventBounds, setEventBounds] = useState<EventBounds | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createSlot, setCreateSlot] = useState<
    { date: string; startTime: string; durationMinutes: number } | undefined
  >(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredView);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_PREF_KEY, mode);
    } catch {
      // localStorage indisponible
    }
  };

  const fetchTables = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/tables`);
      setTables(res.data.data);
    } catch {
      toast.error("Échec du chargement des tables");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const fetchEventBounds = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${eventId}`);
      setEventBounds({
        startDateTime: res.data.data.startDateTime,
        endDateTime: res.data.data.endDateTime,
      });
    } catch {
      // Silencieux : les bornes ne bloquent pas l'affichage de la liste
    }
  }, [eventId]);

  useEffect(() => {
    fetchTables();
    fetchEventBounds();
  }, [fetchTables, fetchEventBounds]);

  useEventSocket(eventId, {
    onTableCreated: fetchTables,
    onTableUpdated: fetchTables,
    onTableDeleted: fetchTables,
    onPlayerJoined: fetchTables,
    onPlayerLeft: fetchTables,
    onPlayerKicked: fetchTables,
    onPlayerPromoted: fetchTables,
    onPlayerDemoted: fetchTables,
    onReconnected: fetchTables,
  });

  const handleTableClick = (tableId: string) => {
    setSelectedTableId(tableId);
  };

  const handleSlotSelect = (slot: { date: string; startTime: string; durationMinutes: number }) => {
    setCreateSlot(slot);
    setShowCreate(true);
  };

  // Toggle liste / calendrier
  const ViewToggle = (
    <div className="flex rounded-lg border border-base-300 p-0.5 gap-0.5">
      <button
        className={`btn btn-xs btn-square ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`}
        onClick={() => switchView("list")}
        aria-label="Vue liste"
        title="Vue liste"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </button>
      <button
        className={`btn btn-xs btn-square ${viewMode === "calendar" ? "btn-primary" : "btn-ghost"}`}
        onClick={() => switchView("calendar")}
        aria-label="Vue calendrier"
        title="Vue calendrier"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>
    </div>
  );

  return (
    <div className={!isMobile ? "flex flex-col h-full" : ""}>
      {/* Header avec toggle + boutons desktop */}
      <div className="flex items-center justify-between mb-4 print-hide flex-none">
        {ViewToggle}
        <div className="flex items-center gap-2">
          {pdfExportEnabled && !isMobile && (
            <button
              className="btn btn-ghost btn-sm gap-1"
              onClick={() => {
                const style = document.createElement("style");
                style.textContent = `@page { size: A4 ${viewMode === "calendar" ? "landscape" : "portrait"}; }`;
                document.head.appendChild(style);
                window.print();
                document.head.removeChild(style);
              }}
              title="Exporter en PDF"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              Exporter en PDF
            </button>
          )}
          {!isMobile && (
            <button
              className="btn btn-primary btn-sm active:scale-95 transition-transform"
              onClick={() => {
                setCreateSlot(undefined);
                setShowCreate(true);
              }}
            >
              Créer une table
            </button>
          )}
        </div>
      </div>

      {/* pb-24 mobile : laisser la place au FAB pour ne pas masquer la derniere carte */}
      <div className={!isMobile ? "flex-1 min-h-0 overflow-y-auto pb-4" : "pb-24"}>
        {loading ? (
          <SkeletonCardGrid count={4} />
        ) : viewMode === "list" ? (
          <TimelineView tables={tables} onTableClick={handleTableClick} />
        ) : eventBounds ? (
          <CalendarView
            tables={tables}
            eventBounds={eventBounds}
            eventId={eventId}
            onTableClick={handleTableClick}
            onTableUpdated={fetchTables}
            onSlotSelect={handleSlotSelect}
          />
        ) : (
          <TimelineView tables={tables} onTableClick={handleTableClick} />
        )}
      </div>

      {isMobile && (
        <div className="print-hide">
          <FAB
            onClick={() => {
              setCreateSlot(undefined);
              setShowCreate(true);
            }}
            label="Créer une table"
          />
        </div>
      )}

      <CreateTableModal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setCreateSlot(undefined);
        }}
        onCreated={fetchTables}
        eventId={eventId}
        prefilledSlot={createSlot}
        eventStartDate={
          eventBounds?.startDateTime ? eventBounds.startDateTime.slice(0, 10) : undefined
        }
        eventEndDate={eventBounds?.endDateTime ? eventBounds.endDateTime.slice(0, 10) : undefined}
      />

      <TableDetailModal
        open={selectedTableId !== null}
        onClose={() => setSelectedTableId(null)}
        tableId={selectedTableId}
        eventId={eventId}
        onTableDeleted={fetchTables}
        onTableUpdated={fetchTables}
      />
    </div>
  );
}
