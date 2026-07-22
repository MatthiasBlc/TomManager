import { useRef, useState, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { DatesSetArg, EventDropArg, EventContentArg, DateSelectArg } from "@fullcalendar/core";
import { EventResizeDoneArg, DateClickArg } from "@fullcalendar/interaction";
import toast from "react-hot-toast";
import api from "../../config/api";
import { useAdminRights } from "../../hooks/useAdminRights";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAuth } from "../../contexts/AuthContext";
import CalendarEventBlock from "./CalendarEventBlock";

// Stable hors du composant pour eviter les re-renders FC
const FC_PLUGINS = [timeGridPlugin, interactionPlugin];

import { type TableSummary } from "./computeLayout";
import { type MealSlot } from "./kitchenSlots";
import { serviceLabel } from "../kitchen/units";
import { getErrorMessage } from "../../config/apiErrors";
import {
  toParisFakeUtc,
  fromParisFakeUtc,
  parisFakeUtcNow,
  parisWallClockParts,
  formatFakeUtcDate,
} from "../../utils/dateTime";

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
  mealSlots?: MealSlot[];
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
    const { h } = parisWallClockParts(eventStart);
    return `${String(Math.max(0, h - 1)).padStart(2, "0")}:00:00`;
  }
  const earliest = tables.reduce((min, t) =>
    new Date(t.startDateTime) < new Date(min.startDateTime) ? t : min
  );
  const { h, min } = parisWallClockParts(earliest.startDateTime);
  return `${String(Math.max(0, h - 1)).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
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
  mealSlots = [],
  eventBounds,
  eventId,
  onTableClick,
  onTableUpdated,
  onSlotSelect,
}: Props) {
  const { canModerateTables } = useAdminRights();
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

  const [currentDate, setCurrentDate] = useState<Date>(toParisFakeUtc(eventBounds.startDateTime));

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCurrentDate(arg.start);
  }, []);

  const goNext = () => calendarRef.current?.getApi().next();
  const goPrev = () => calendarRef.current?.getApi().prev();

  // Appel API commun pour drag et resize. `fakeStart`/`fakeEnd` sont les Date
  // "fake UTC" renvoyees par FullCalendar (timeZone="UTC") : on les reconvertit en
  // instants reels avant tout usage (payload API, comparaison avec les tables
  // reelles de `tablesRef.current` dans findGmOverlap) — sinon on comparerait un
  // Date fake-UTC a des Date reels.
  const patchTableDates = useCallback(
    async (tableId: string, fakeStart: Date, fakeEnd: Date, revertFunc: () => void) => {
      const newStart = new Date(fromParisFakeUtc(fakeStart));
      const newEnd = new Date(fromParisFakeUtc(fakeEnd));

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
        toast.error(getErrorMessage(err, "Échec du déplacement"));
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

  // `info.start`/`info.date` sont des Date "fake UTC" (timeZone="UTC") : les
  // getters UTC (jamais locaux) donnent directement l'heure murale de Paris.
  const handleSelect = useCallback(
    (info: DateSelectArg) => {
      if (!onSlotSelect) return;
      const start = info.start;
      const end = info.end;
      const date = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
      const startTime = `${String(start.getUTCHours()).padStart(2, "0")}:${String(start.getUTCMinutes()).padStart(2, "0")}`;
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
      onSlotSelect({ date, startTime, durationMinutes });
    },
    [onSlotSelect]
  );

  // Clic simple sur un creneau vide : ouvre le modal avec duree par defaut (60 min)
  const handleDateClick = useCallback(
    (info: DateClickArg) => {
      if (!onSlotSelect) return;
      const start = info.date;
      const date = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
      const startTime = `${String(start.getUTCHours()).padStart(2, "0")}:${String(start.getUTCMinutes()).padStart(2, "0")}`;
      onSlotSelect({ date, startTime, durationMinutes: 60 });
    },
    [onSlotSelect]
  );

  const calEvents = useMemo(() => {
    const tableEvents = tables.map((t) => ({
      id: t.id,
      title: t.title,
      start: toParisFakeUtc(t.startDateTime),
      end: toParisFakeUtc(t.endDateTime),
      editable: t.isGM || canModerateTables,
      extendedProps: {
        kind: "table" as const,
        isGM: t.isGM,
        currentUserStatus: t.currentUserStatus,
        confirmedCount: t.confirmedCount,
        maxPlayers: t.maxPlayers,
        reservedSeats: t.reservedSeats,
        waitlistCount: t.waitlistCount,
        confirmedOnReserved: t.confirmedOnReserved,
        type: t.type,
        currentUserConflict: t.currentUserConflict,
        conflictingPlayerCount: t.conflictingPlayerCount,
        players: t.players,
        gmUsername: t.creator.displayName ?? t.creator.username,
        tags: t.tags,
      },
    }));

    // Creneaux cuisine : lecture seule (pas de drag/resize), rendus a cote des tables.
    // Prefixe d'id pour ne pas collisionner avec un tableId et permettre d'ignorer le
    // clic (l'inscription se fait dans l'onglet Info).
    const mealEvents = mealSlots.map((m) => {
      const isChef = !!user && m.chef?.id === user.id;
      return {
        id: `meal:${m.id}`,
        title: m.name,
        start: toParisFakeUtc(m.startDateTime),
        end: toParisFakeUtc(m.endDateTime),
        editable: false,
        extendedProps: {
          kind: "meal" as const,
          service: serviceLabel(m.service),
          chefName: m.chef ? (m.chef.displayName ?? m.chef.username) : null,
          assistantCount: m.assistants.length,
          maxAssistants: m.maxAssistants,
          currentUserConflict: m.currentUserConflict,
          // Le conflit "chef" (compte) n'est montre qu'au chef du repas, et seulement
          // s'il n'est pas lui-meme la personne en conflit
          showChefConflict: isChef && !m.currentUserConflict && m.conflictingCount > 0,
          conflictingCount: m.conflictingCount,
        },
      };
    });

    return [...tableEvents, ...mealEvents];
  }, [tables, mealSlots, canModerateTables, user]);

  const validRange = useMemo(
    () => ({
      start: toParisFakeUtc(eventBounds.startDateTime),
      end: toParisFakeUtc(eventBounds.endDateTime),
    }),
    [eventBounds.startDateTime, eventBounds.endDateTime]
  );

  const renderEventContent = useCallback(
    (arg: EventContentArg) => <CalendarEventBlock arg={arg} />,
    []
  );

  const initialView = isMobile ? "timeGridDay" : "timeGridEventRange";

  // `d` est une Date "fake UTC" (currentDate, alimente par arg.start de datesSet) :
  // formatFakeUtcDate force timeZone: "UTC", jamais formatParisDate qui
  // reappliquerait un decalage en trop.
  const formatMobileHeader = (d: Date) =>
    formatFakeUtcDate(d, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <div className={`fc-wrapper animate-fade-in ${!isMobile ? "h-full" : ""}`}>
      {/* Navigation mobile */}
      {isMobile && (
        <div className="mb-2 flex items-center justify-between">
          <button
            className="btn btn-ghost btn-sm btn-square min-h-[44px] min-w-[44px]"
            onClick={goPrev}
            aria-label="Jour précédent"
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
            className="btn btn-ghost btn-sm btn-square min-h-[44px] min-w-[44px]"
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
        timeZone="UTC"
        initialDate={toParisFakeUtc(eventBounds.startDateTime)}
        validRange={validRange}
        headerToolbar={false}
        allDaySlot={false}
        slotDuration="00:15:00"
        slotLabelInterval="01:00:00"
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        scrollTime={scrollTime}
        height={isMobile ? "calc(100dvh - 220px)" : "100%"}
        events={calEvents}
        eventContent={renderEventContent}
        eventClick={(info) => {
          // Les creneaux cuisine sont informatifs : pas de modale de table
          if (info.event.extendedProps.kind === "meal") return;
          onTableClick(info.event.id);
        }}
        datesSet={handleDatesSet}
        locale="fr"
        firstDay={1}
        nowIndicator
        now={() => parisFakeUtcNow()}
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
        // Permet les tables simultanees mais les affiche cote a cote
        eventOverlap
        slotEventOverlap={false}
        // Clic/selection sur un creneau vide pour creer une table
        selectable={!!onSlotSelect}
        selectMirror
        unselectAuto
        select={handleSelect}
        dateClick={onSlotSelect ? handleDateClick : undefined}
      />
    </div>
  );
}
