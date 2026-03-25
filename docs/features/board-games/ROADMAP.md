# Roadmap : Board Games (Jeux de societe)

> Chaque session est autonome et deployable. Cocher au fur et a mesure.

---

## Session 1 : Migration Prisma + Modeles DB

- [x] Ajouter model `BoardGame` avec champs et index sur name
- [x] Ajouter model `EventBoardGame` avec relations et contrainte unique
- [x] Ajouter contrainte unique partielle `(externalSource, externalId)` sur BoardGame
- [x] Ajouter relations sur User et Event
- [x] Generer et appliquer la migration
- [x] Mettre a jour `.claude/context/DB_MODELS.md`
- [x] Mettre a jour globalSetup.ts (cleanup des nouvelles tables)

---

## Session 2 : Service BGG + BoardGame CRUD backend

- [x] Installer dep XML parser si necessaire (ex: `fast-xml-parser`)
- [x] Creer `services/bgg.ts` — client HTTP BGG XML API v2
  - searchBGG(query) : parse XML search results
  - fetchBGGThing(bggId) : parse XML thing detail
  - Timeout 5s, 1 retry
- [x] Creer `services/boardGame.ts` — searchBoardGames, getBoardGame, createBoardGame
  - searchBoardGames : local ILIKE + fallback BGG, dedup, max 20
  - getBoardGame : lazy fetch BGG si stub (description NULL)
  - createBoardGame : creation manuelle
- [x] Creer `controllers/boardGame.ts` — handlers search, detail, create
- [x] Creer `routes/boardGame.ts` — GET /search, GET /:id, POST /
- [x] Brancher dans `routes/index.ts`
- [x] Tests integration :
  - Recherche locale (happy path)
  - Recherche avec fallback BGG (mock HTTP)
  - Detail avec lazy fetch BGG (mock HTTP)
  - Creation manuelle (happy path, validation)
  - Parsing XML BGG (mock responses)
- [x] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 3 : EventBoardGame CRUD backend + cascade

- [x] Creer `services/eventBoardGame.ts` — addToEvent, listByEvent, removeFromEvent
  - addToEvent : verif participant, verif doublon -> 409
  - listByEvent : avec infos BoardGame + broughtBy user
  - removeFromEvent : owner ou admin, sinon 403
- [x] Creer `controllers/eventBoardGame.ts` — handlers add, list, remove
- [x] Creer `routes/eventBoardGame.ts` — POST, GET, DELETE
- [x] Brancher dans `routes/index.ts`
- [x] Modifier `services/participant.ts` — cascade retrait participant inclut EventBoardGame
- [x] Tests integration :
  - Ajout a l'event (happy path, doublon 409, non-participant 403)
  - Liste jeux event (avec infos jeu + qui l'amene)
  - Retrait (owner OK, admin OK, non-owner 403)
  - Cascade retrait participant (EventBoardGame supprimees)
- [x] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 4 : Frontend — BoardGameTab + recherche + ajout

- [x] Creer `components/boardgames/BoardGameSearchInput.tsx` — autocomplete avec debounce
- [x] Creer `components/boardgames/BoardGameCard.tsx` — carte jeu (image, nom, annee, joueurs)
- [x] Creer `components/boardgames/BoardGameList.tsx` — liste groupee par jeu
- [x] Creer `components/boardgames/AddBoardGameModal.tsx` — modal recherche + ajout
- [x] Creer `components/boardgames/ManualBoardGameForm.tsx` — formulaire creation manuelle
- [x] Creer `components/boardgames/BoardGameTab.tsx` — onglet integrant liste + bouton ajout
- [x] Ajouter onglet "Jeux" dans EventDetailPage
- [x] Mettre a jour `.claude/context/FILE_MAP.md`

---

## Session 5 : Tests + polish + mise a jour docs

- [x] Verifier tous les tests passent (backend + frontend) — 123+1 = 124
- [x] Mettre a jour `.claude/context/PROGRESS.md` (phase 4 terminee)
- [x] Mettre a jour `.claude/context/TESTS.md`
- [x] Mettre a jour `.claude/context/FILE_MAP.md` (final)
