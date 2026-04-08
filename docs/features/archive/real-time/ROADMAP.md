# Roadmap : Real-Time (Socket.io)

> Chaque session est autonome et deployable. Cocher au fur et a mesure.

---

## Session 1 : Setup Socket.io + auth middleware + emit infrastructure

- [x] Installer `socket.io` (backend) et `socket.io-client` (frontend)
- [x] Creer `backend/src/socket/index.ts` — setup IO, session auth middleware, room handlers
- [x] Exporter singleton `getIO()` pour usage dans les services
- [x] Modifier `backend/src/server.ts` — attacher Socket.io au serveur HTTP
- [x] Modifier `backend/src/app.ts` — exporter le session middleware pour reutilisation
- [x] Tests integration :
  - Connexion WebSocket avec session valide
  - Rejet connexion sans session
  - Join/leave room event

---

## Session 2 : Emit events depuis les services backend

- [x] Modifier `services/gameTable.ts` — emit table:created, table:updated, table:deleted
- [x] Modifier `services/gameTable.ts` — emit table:player:joined, table:player:left, table:player:kicked
- [x] Modifier `services/gameTable.ts` — emit table:player:promoted, table:player:demoted
- [x] Modifier `services/eventBoardGame.ts` — emit boardgame:added, boardgame:removed
- [x] Modifier `services/participant.ts` — emit participant:removed
- [x] Tests integration :
  - Reception table:created dans la room quand une table est creee
  - Reception table:player:joined quand un joueur rejoint

---

## Session 3 : Frontend hooks + integration pages

- [x] Creer `frontend/src/hooks/useSocket.ts` — connexion singleton
- [x] Creer `frontend/src/hooks/useEventSocket.ts` — join/leave room, ecoute events
- [x] Creer `frontend/src/components/common/ConnectionStatus.tsx` — indicateur navbar
- [x] Modifier `PlanningPage.tsx` — refetch sur table:created/updated/deleted
- [x] Modifier `TableDetailPage.tsx` — refetch sur player events
- [x] Modifier `BoardGameTab.tsx` — refetch sur boardgame events
- [x] Modifier `Navbar.tsx` — integrer ConnectionStatus
- [x] Mettre a jour `.claude/context/FILE_MAP.md`

---

## Session 4 : Tests + polish + mise a jour docs

- [x] Verifier tous les tests passent (backend + frontend) — 127+1 = 128
- [x] Mettre a jour `.claude/context/PROGRESS.md` (phase 5 terminee)
- [x] Mettre a jour `.claude/context/TESTS.md`
- [x] Mettre a jour `.claude/context/FILE_MAP.md` (final)
