# Roadmap : Vue Calendrier avec Drag & Drop

Spec complete : `SPEC_CALENDAR_VIEW.md`

## Phase 1 — Affichage read-only [DONE]

- [x] Installer `@fullcalendar/react`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`
- [x] `CalendarView.tsx` : tables -> evenements FC, color coding, bloc custom `CalendarEventBlock.tsx`
- [x] Toggle liste/calendrier dans `PlanningTab` (localStorage)
- [x] Fetch dates de l'event dans `PlanningTab`
- [x] Affichage multi-jours, simultanee, scroll auto vers premiere table

## Phase 2 — Drag & drop [DONE]

- [x] `eventDrop` -> PATCH API + optimistic update + revert sur erreur
- [x] `validRange` pour borner aux dates de l'event
- [x] Permissions : `editable` par table (isGM || isAdmin)

## Phase 3 — Resize [DONE]

- [x] `eventResize` -> PATCH API (meme logique que drag)
- [x] Snap 15 min (snapDuration + slotDuration coherents)

## Phase 4 — Polish [DONE]

- [x] Warning toast si chevauchement entre tables du meme GM
- [x] Navigation jour par jour sur mobile (boutons prev/next)
- [x] CSS overrides pour matcher le theme DaisyUI
- [x] Mise a jour FILE_MAP.md
