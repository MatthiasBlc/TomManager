# Roadmap : Planning System (GameTables)

> Chaque session est autonome et deployable. Cocher au fur et a mesure.

---

## Session 1 : Migration Prisma + Modeles DB

- [x] Ajouter enum `TableParticipantStatus` (CONFIRMED, WAITLIST)
- [x] Ajouter model `GameTable` avec relations et index
- [x] Ajouter model `Tag` (name unique lowercase)
- [x] Ajouter model `GameTableTag` (PK composite)
- [x] Ajouter model `GameTableParticipant` avec contrainte unique et index
- [x] Ajouter relations sur User et Event
- [x] Generer et appliquer la migration
- [x] Mettre a jour `.claude/context/DB_MODELS.md`
- [x] Mettre a jour globalSetup.ts (cleanup des nouvelles tables)

---

## Session 2 : Middleware + Tag service + Table CRUD backend (create, list, detail)

- [x] Ajouter middleware `requireTableGMOrAdmin` dans `middleware/auth.ts`
- [x] Creer `services/tag.ts` — findOrCreateTags, searchTags
- [x] Creer `controllers/tag.ts` + `routes/tag.ts` — GET /api/tags?q=
- [x] Creer `services/gameTable.ts` — createTable, listTables, getTable
  - createTable : validation, GM = createdBy, find-or-create tags
  - listTables : avec GM info, tags, confirmed/waitlist counts, currentUserStatus
  - getTable : avec liste participants ordonnee
- [x] Creer `controllers/gameTable.ts` — handlers create, list, detail
- [x] Creer `routes/gameTable.ts` — POST, GET /, GET /:tableId
- [x] Brancher dans `routes/index.ts`
- [x] Tests integration :
  - Table create (happy path, validation dates, validation fields)
  - Table list (avec counts)
  - Table detail (avec participants)
  - Tag autocomplete
- [x] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 3 : Table update, delete + join/leave/kick

- [x] Ajouter `updateTable(tableId, data)` dans `services/gameTable.ts`
  - Transaction reduction maxPlayers (demotion)
  - Transaction augmentation maxPlayers (promotion)
- [x] Ajouter `deleteTable(tableId)` — hard delete cascade
- [x] Ajouter `joinTable(tableId, userId)` — transaction serialisable
  - Lock FOR UPDATE, verif pas GM, verif pas deja participant
  - CONFIRMED si place, sinon WAITLIST
  - Detection overlap (warning)
- [x] Ajouter `leaveTable(tableId, userId)` — transaction promotion
- [x] Ajouter `kickPlayer(tableId, userId)` — meme logique que leave
- [x] Ajouter handlers + routes (PATCH, DELETE, POST join, DELETE leave, DELETE kick)
- [x] Tests integration :
  - Update table (GM, non-GM 403)
  - Delete table (GM, non-GM 403, cascade)
  - Join (confirmed, waitlist, already participant 409, GM 400)
  - Leave (happy path, promotion waitlist)
  - Kick (GM OK, non-GM 403)
  - Reduction maxPlayers (demotion)
  - Augmentation maxPlayers (promotion)
- [x] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 4 : Cascades (dates event + retrait participant)

- [x] Modifier `updateEvent` — cascade dates sur GameTables
  - Clamper dates tables, supprimer si invalides
- [x] Modifier `removeParticipant` / `leaveEvent` — cascade tables
  - Supprimer GameTables creees par le user
  - Supprimer GameTableParticipant pour le user
  - Promouvoir waitlist si necessaire
- [x] Modifier `deleteEvent` — cascade GameTables + participants + tags
- [x] Tests integration :
  - Cascade dates event (clamp, suppression tables invalides)
  - Cascade retrait participant (tables supprimees, participations retirees)
  - Cascade delete event (tout nettoye)
- [x] Mettre a jour `.claude/context/API_MAP.md` si besoin

---

## Session 5 : Frontend — PlanningPage + TableCard + CreateTableModal

- [ ] Creer `pages/PlanningPage.tsx` — vue timeline des tables
- [ ] Creer `components/planning/TimelineView.tsx` — affichage chronologique
- [ ] Creer `components/planning/TableCard.tsx` — carte table
- [ ] Creer `components/planning/CreateTableModal.tsx` — formulaire creation
- [ ] Creer `components/planning/TagInput.tsx` — autocomplete multi-select
- [ ] Ajouter route `/events/:eventId/planning` + onglet dans EventDetailPage
- [ ] Mettre a jour `.claude/context/FILE_MAP.md`

---

## Session 6 : Frontend — TableDetailDrawer + EditTableModal + join/leave

- [ ] Creer `components/planning/TableDetailDrawer.tsx` — detail + participants
- [ ] Creer `components/planning/EditTableModal.tsx` — modification table
- [ ] Ajouter logique join/leave/kick dans le drawer
- [ ] Creer `components/planning/WaitlistBadge.tsx`
- [ ] Creer `components/planning/OverlapWarning.tsx`
- [ ] Mettre a jour `.claude/context/FILE_MAP.md`

---

## Session 7 : Tests + polish + mise a jour docs

- [ ] Verifier tous les tests passent (backend + frontend)
- [ ] Mettre a jour `.claude/context/PROGRESS.md` (phase 3 terminee)
- [ ] Mettre a jour `.claude/context/TESTS.md`
- [ ] Mettre a jour `.claude/context/FILE_MAP.md` (final)
