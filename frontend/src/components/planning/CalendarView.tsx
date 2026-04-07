import { useRef, useState, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { DatesSetArg, EventDropArg, EventContentArg, DateSelectArg } from "@fullcalendar/core";
import { EventResizeDoneArg } from "@fullcalendar/interaction";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import CalendarEventBlock from "./CalendarEventBlock";

// Stable hors du composant pour eviter les re-renders FC
const FC_PLUGINS = [timeGridPlugin, interactionPlugin];

interface TableSummary {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  creator: { id: string; username: string };
  type: "JDR" | "JDS";
  confirmedCount: number;
  waitlistCount: number;
  maxPlayers: number;
  currentUserStatus: string | null;
  isGM: boolean;
}

interface EventBounds {
  startDateTime: string;
  endDateTime: string;
}

interface SlotSelection {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
}

interface Props {
  tables: TableSummary[];
  eventBounds: EventBounds;
  eventId: string;
  onTableClick: (tableId: string) => void;
  onTableUpdated: () => void;
  onSlotSelect?: (slot: SlotSelection) => void;
}

function calcNbDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.min(7, Math.ceil(ms / (1000 * 60 * 60 * 24))));
}

function firstTableScrollTime(tables: TableSummary[], eventStart: string): string {
  if (tables.length === 0) {
    const h = new Date(eventStart).getHours();
    return `${String(Math.max(0, h - 1)).padStart(2, "0")}:00:00`;
  }
  const earliest = tables.reduce((min, t) =>
    new Date(t.startDateTime) < new Date(min.startDateTime) ? t : min
  );
  const d = new Date(earliest.startDateTime);
  const h = Math.max(0, d.getHours() - 1);
  return `${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
}

// Verifie si la table deplacee chevauche une autre table du meme GM
function findGmOverlap(
  movedTableId: string,
  newStart: Date,
  newEnd: Date,
  tables: TableSummary[]
): string | null {
  for (const t of tables) {
    if (t.id === movedTableId) continue;
    if (!t.isGM) continue; // seules les tables dont l'user est GM peuvent creer un conflit
    const tStart = new Date(t.startDateTime);
    const tEnd = new Date(t.endDateTime);
    if (newStart < tEnd && newEnd > tStart) return t.title;
  }
  return null;
}

export default function CalendarView({
  tables,
  eventBounds,
  eventId,
  onTableClick,
  onTableUpdated,
  onSlotSelect,
}: Props) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const calendarRef = useRef<FullCalendar>(null);
  // Ref pour avoir les tables a jour dans les callbacks sans les declarer comme dependances
  const tablesRef = useRef(tables);
  tablesRef.current = tables;

  const nbDays = useMemo(
    () => calcNbDays(eventBounds.startDateTime, eventBounds.endDateTime),
    [eventBounds.startDateTime, eventBounds.endDateTime]
  );

  const fcViews = useMemo(
    () => ({
      timeGridEventRange: {
        type: "timeGrid" as const,
        duration: { days: nbDays },
      },
    }),
    [nbDays]
  );

  // scrollTime calcule une seule fois au montage
  const scrollTime = useRef(firstTableScrollTime(tables, eventBounds.startDateTime)).current;

  const [currentDate, setCurrentDate] = useState<Date>(new Date(eventBounds.startDateTime));

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCurrentDate(arg.start);
  }, []);

  const goNext = () => calendarRef.current?.getApi().next();
  const goPrev = () => calendarRef.current?.getApi().prev();

  // Appel API commun pour drag et resize
  const patchTableDates = useCallback(
    async (tableId: string, newStart: Date, newEnd: Date, revertFunc: () => void) => {
      // Warning si chevauchement avec une autre table du meme GM
      const overlap = findGmOverlap(tableId, newStart, newEnd, tablesRef.current);
      if (overlap) {
        toast(`Attention : chevauche "${overlap}"`, { icon: "⚠️" });
      }

      try {
        await api.patch(`/api/events/${eventId}/tables/${tableId}`, {
          startDateTime: newStart.toISOString(),
          endDateTime: newEnd.toISOString(),
        });
        onTableUpdated();
      } catch (err: unknown) {
        revertFunc();
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message || "Echec du deplacement";
        toast.error(message);
      }
    },
    [eventId, onTableUpdated]
  );

  const handleEventDrop = useCallback(
    (info: EventDropArg) => {
      if (!info.event.start || !info.event.end) {
        info.revert();
        return;
      }
      patchTableDates(info.event.id, info.event.start, info.event.end, info.revert);
    },
    [patchTableDates]
  );

  const handleEventResize = useCallback(
    (info: EventResizeDoneArg) => {
      if (!info.event.start || !info.event.end) {
        info.revert();
        return;
      }
      patchTableDates(info.event.id, info.event.start, info.event.end, info.revert);
    },
    [patchTableDates]
  );

  const isAdmin = user?.role === "ADMIN";

  const handleSelect = useCallback(
    (info: DateSelectArg) => {
      if (!onSlotSelect) return;
      const start = info.start;
      const end = info.end;
      const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      const startTime = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
      onSlotSelect({ date, startTime, durationMinutes });
    },
    [onSlotSelect]
  );

  const calEvents = useMemo(
    () =>
      tables.map((t) => ({
        id: t.id,
        title: t.title,
        start: t.startDateTime,
        end: t.endDateTime,
        editable: t.isGM || isAdmin,
        extendedProps: {
          isGM: t.isGM,
          currentUserStatus: t.currentUserStatus,
          confirmedCount: t.confirmedCount,
          maxPlayers: t.maxPlayers,
          waitlistCount: t.waitlistCount,
          type: t.type,
        },
      })),
    [tables, isAdmin]
  );

  const validRange = useMemo(
    () => ({
      start: eventBounds.startDateTime,
      end: eventBounds.endDateTime,
    }),
    [eventBounds.startDateTime, eventBounds.endDateTime]
  );

  const renderEventContent = useCallback(
    (arg: EventContentArg) => <CalendarEventBlock arg={arg} />,
    []
  );

  const initialView = isMobile ? "timeGridDay" : "timeGridEventRange";

  const formatMobileHeader = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <div className="fc-wrapper animate-fade-in">
      {/* Navigation mobile */}
      {isMobile && (
        <div className="mb-2 flex items-center justify-between">
          <button
            className="btn btn-ghost btn-sm btn-square"
            onClick={goPrev}
            aria-label="Jour precedent"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium capitalize">{formatMobileHeader(currentDate)}</span>
          <button
            className="btn btn-ghost btn-sm btn-square"
            onClick={goNext}
            aria-label="Jour suivant"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={FC_PLUGINS}
        initialView={initialView}
        views={fcViews}
        initialDate={eventBounds.startDateTime}
        validRange={validRange}
        headerToolbar={false}
        allDaySlot={false}
        slotDuration="00:15:00"
        slotLabelInterval="01:00:00"
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        scrollTime={scrollTime}
        height={isMobile ? "calc(100dvh - 220px)" : "calc(100dvh - 200px)"}
        events={calEvents}
        eventContent={renderEventContent}
        eventClick={(info) => onTableClick(info.event.id)}
        datesSet={handleDatesSet}
        locale="fr"
        firstDay={1}
        nowIndicator
        // Drag & drop
        editable
        eventStartEditable
        eventDurationEditable
        // Snap 15 min (coherent avec slotDuration)
        snapDuration="00:15:00"
        // Long press pour declencher le drag sur mobile
        longPressDelay={500}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        // Permet les tables simultanees
        eventOverlap
        // Clic/selection sur un creneau vide pour creer une table
        selectable={!!onSlotSelect}
        selectMirror
        unselectAuto
        select={handleSelect}
      />
    </div>
  );
}
