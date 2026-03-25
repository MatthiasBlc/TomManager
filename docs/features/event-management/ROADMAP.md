# Roadmap : Event Management

> Chaque session est autonome et deployable. Cocher au fur et a mesure.

---

## Session 1 : Middlewares + Event CRUD backend (list, detail, update, delete)

- [x] Ajouter middleware `requireEventParticipant` dans `middleware/auth.ts`
- [x] Ajouter middleware `requireEventCreator` dans `middleware/auth.ts`
- [x] Ajouter `listEvents(userId, role, upcoming?)` dans `services/event.ts`
- [x] Ajouter `getEvent(eventId)` dans `services/event.ts`
- [x] Ajouter `updateEvent(eventId, data)` dans `services/event.ts`
  - Mettre a jour expiresAt des invitations PENDING si dates changent
- [x] Ajouter `deleteEvent(eventId)` dans `services/event.ts`
  - Cascade : invitations + participations
- [x] Ajouter handlers dans `controllers/event.ts` (list, detail, update, delete)
- [x] Ajouter routes dans `routes/event.ts` (GET /, GET /:eventId, PATCH /:eventId, DELETE /:eventId)
- [x] Tests integration :
  - List events (USER/ADMIN, upcoming filter)
  - Detail event (participant, non-participant, admin)
  - Update event (createur, non-createur, validation)
  - Delete event (createur, non-createur, cascade)
- [x] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 2 : Invitations listing + Participants CRUD backend

- [x] Ajouter `listInvitations(eventId)` dans `services/invitation.ts`
- [x] Ajouter handler + route GET `/api/events/:eventId/invitations`
- [x] Creer `services/participant.ts` :
  - `listParticipants(eventId)` — userId, username, role, joinedAt
  - `removeParticipant(eventId, userId)` — verif createur, cascade basique
  - `leaveEvent(eventId, userId)` — verif createur, meme cascade
- [x] Creer `controllers/participant.ts`
- [x] Creer `routes/participant.ts` :
  - `GET /api/events/:eventId/participants`
  - `DELETE /api/events/:eventId/participants/me`
  - `DELETE /api/events/:eventId/participants/:userId`
- [x] Brancher dans `routes/index.ts`
- [x] Tests integration :
  - Invitation listing (createur OK, non-createur 403)
  - Participant listing (participant OK, non-participant 403)
  - Remove participant (createur OK, self-remove impossible, non-createur 403)
  - Leave event (participant OK, createur impossible)
- [x] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 3 : Frontend — Navbar + EventListPage + CreateEventModal

- [ ] Creer `components/layout/Navbar.tsx` — logo, lien events, logout
- [ ] Integrer Navbar dans layout (AppRoutes ou App)
- [ ] Creer `pages/EventListPage.tsx` — grille cards, bouton creation (admin)
- [ ] Creer `components/events/CreateEventModal.tsx` — formulaire nom/dates
- [ ] Ajouter route `/events` dans `AppRoutes.tsx`
- [ ] Mettre a jour `.claude/context/FILE_MAP.md`

---

## Session 4 : Frontend — EventDetailPage + EditEventModal + ParticipantList + InvitationManager

- [ ] Creer `pages/EventDetailPage.tsx` — onglets info/participants/invitations
- [ ] Creer `components/events/EditEventModal.tsx` — modification event
- [ ] Creer `components/events/ParticipantList.tsx` — liste + actions admin
- [ ] Creer `components/events/InvitationManager.tsx` — envoi + liste invitations
- [ ] Ajouter route `/events/:eventId` dans `AppRoutes.tsx`
- [ ] Mettre a jour `.claude/context/FILE_MAP.md`

---

## Session 5 : Tests + polish + mise a jour docs

- [ ] Verifier tous les tests passent (backend + frontend)
- [ ] Mettre a jour `.claude/context/PROGRESS.md` (phase 2 terminee)
- [ ] Mettre a jour `.claude/context/TESTS.md`
- [ ] Mettre a jour `.claude/context/FILE_MAP.md` (final)
