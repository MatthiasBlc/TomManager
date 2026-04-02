# Roadmap : Vue Calendrier avec Drag & Drop

Spec complete : `SPEC_CALENDAR_VIEW.md`

## Phase 1 — Affichage read-only
- [ ] Installer `@fullcalendar/react`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`
- [ ] `CalendarView.tsx` : tables → evenements FC, color coding, bloc custom `CalendarEventBlock.tsx`
- [ ] Toggle liste/calendrier dans `PlanningTab` (localStorage)
- [ ] Fetch dates de l'event dans `PlanningTab`
- [ ] Affichage multi-jours, simultanee, scroll auto vers premiere table

## Phase 2 — Drag & drop
- [ ] `eventDrop` → PATCH API + optimistic update + revert sur erreur
- [ ] `validRange` pour borner aux dates de l'event
- [ ] Permissions : `editable` par table (isGM || isAdmin)

## Phase 3 — Resize
- [ ] `eventResize` → PATCH API (meme logique que drag)
- [ ] Poignee visible sur mobile

## Phase 4 — Polish
- [ ] Warning toast si chevauchement entre tables du meme GM
- [ ] Navigation jour par jour sur mobile (swipe ou boutons)
- [ ] Surcharge CSS pour matcher le theme DaisyUI/TailwindCSS
- [ ] Tests unitaires `CalendarView.test.tsx`
- [ ] Mise a jour `docs/MANUAL_TESTING.md`
