import { useRef, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { DatesSetArg } from "@fullcalendar/core";
import { useIsMobile } from "../../hooks/useIsMobile";
import CalendarEventBlock from "./CalendarEventBlock";

interface TableSummary {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  creator: { id: string; username: string };
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

interface Props {
  tables: TableSummary[];
  eventBounds: EventBounds;
  onTableClick: (tableId: string) => void;
}

function calcNbDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.min(7, Math.ceil(ms / (1000 * 60 * 60 * 24))));
}

function firstTableScrollTime(tables: TableSummary[], eventStart: string): string {
  if (tables.length === 0) {
    // Scroll vers le debut de l'event par defaut
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

export default function CalendarView({ tables, eventBounds, onTableClick }: Props) {
  const isMobile = useIsMobile();
  const calendarRef = useRef<FullCalendar>(null);
  const nbDays = calcNbDays(eventBounds.startDateTime, eventBounds.endDateTime);
  const scrollTime = firstTableScrollTime(tables, eventBounds.startDateTime);

  // Pour le header mobile : date courante affichee
  const [currentDate, setCurrentDate] = useState<Date>(
    new Date(eventBounds.startDateTime)
  );

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCurrentDate(arg.start);
  }, []);

  const goNext = () => calendarRef.current?.getApi().next();
  const goPrev = () => calendarRef.current?.getApi().prev();

  const calEvents = tables.map((t) => ({
    id: t.id,
    title: t.title,
    start: t.startDateTime,
    end: t.endDateTime,
    // Desactive les interactions FC natives - on gere le click manuellement
    editable: false,
    extendedProps: {
      isGM: t.isGM,
      currentUserStatus: t.currentUserStatus,
      confirmedCount: t.confirmedCount,
      maxPlayers: t.maxPlayers,
      waitlistCount: t.waitlistCount,
    },
  }));

  const validRange = {
    start: eventBounds.startDateTime,
    end: eventBounds.endDateTime,
  };

  // Vue desktop : toutes les journees de l'event cote a cote
  // Vue mobile : une journee a la fois avec navigation
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
          <span className="text-sm font-medium capitalize">
            {formatMobileHeader(currentDate)}
          </span>
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
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        views={{
          timeGridEventRange: {
            type: "timeGrid",
            duration: { days: nbDays },
          },
        }}
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
        eventContent={(arg) => <CalendarEventBlock arg={arg} />}
        eventClick={(info) => onTableClick(info.event.id)}
        datesSet={handleDatesSet}
        locale="fr"
        firstDay={1}
        nowIndicator
        // Pas de drag/resize en phase 1
        editable={false}
        eventStartEditable={false}
        eventDurationEditable={false}
        // Touch : long press pour selectionner (sera utile phase 2)
        longPressDelay={500}
        // Colonnes simultanees cote a cote
        eventOverlap
      />
    </div>
  );
}
