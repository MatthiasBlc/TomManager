# Roadmap : Board Games (Jeux de societe)

> Chaque session est autonome et deployable. Cocher au fur et a mesure.

---

## Session 1 : Migration Prisma + Modeles DB

- [ ] Ajouter model `BoardGame` avec champs et index sur name
- [ ] Ajouter model `EventBoardGame` avec relations et contrainte unique
- [ ] Ajouter contrainte unique partielle `(externalSource, externalId)` sur BoardGame
- [ ] Ajouter relations sur User et Event
- [ ] Generer et appliquer la migration
- [ ] Mettre a jour `.claude/context/DB_MODELS.md`
- [ ] Mettre a jour globalSetup.ts (cleanup des nouvelles tables)

---

## Session 2 : Service BGG + BoardGame CRUD backend

- [ ] Installer dep XML parser si necessaire (ex: `fast-xml-parser`)
- [ ] Creer `services/bgg.ts` — client HTTP BGG XML API v2
  - searchBGG(query) : parse XML search results
  - fetchBGGThing(bggId) : parse XML thing detail
  - Timeout 5s, 1 retry
- [ ] Creer `services/boardGame.ts` — searchBoardGames, getBoardGame, createBoardGame
  - searchBoardGames : local ILIKE + fallback BGG, dedup, max 20
  - getBoardGame : lazy fetch BGG si stub (description NULL)
  - createBoardGame : creation manuelle
- [ ] Creer `controllers/boardGame.ts` — handlers search, detail, create
- [ ] Creer `routes/boardGame.ts` — GET /search, GET /:id, POST /
- [ ] Brancher dans `routes/index.ts`
- [ ] Tests integration :
  - Recherche locale (happy path)
  - Recherche avec fallback BGG (mock HTTP)
  - Detail avec lazy fetch BGG (mock HTTP)
  - Creation manuelle (happy path, validation)
  - Parsing XML BGG (mock responses)
- [ ] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 3 : EventBoardGame CRUD backend + cascade

- [ ] Creer `services/eventBoardGame.ts` — addToEvent, listByEvent, removeFromEvent
  - addToEvent : verif participant, verif doublon -> 409
  - listByEvent : avec infos BoardGame + broughtBy user
  - removeFromEvent : owner ou admin, sinon 403
- [ ] Creer `controllers/eventBoardGame.ts` — handlers add, list, remove
- [ ] Creer `routes/eventBoardGame.ts` — POST, GET, DELETE
- [ ] Brancher dans `routes/index.ts`
- [ ] Modifier `services/participant.ts` — cascade retrait participant inclut EventBoardGame
- [ ] Tests integration :
  - Ajout a l'event (happy path, doublon 409, non-participant 403)
  - Liste jeux event (avec infos jeu + qui l'amene)
  - Retrait (owner OK, admin OK, non-owner 403)
  - Cascade retrait participant (EventBoardGame supprimees)
- [ ] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 4 : Frontend — BoardGameTab + recherche + ajout

- [ ] Creer `components/boardgames/BoardGameSearchInput.tsx` — autocomplete avec debounce
- [ ] Creer `components/boardgames/BoardGameCard.tsx` — carte jeu (image, nom, annee, joueurs)
- [ ] Creer `components/boardgames/BoardGameList.tsx` — liste groupee par jeu
- [ ] Creer `components/boardgames/AddBoardGameModal.tsx` — modal recherche + ajout
- [ ] Creer `components/boardgames/ManualBoardGameForm.tsx` — formulaire creation manuelle
- [ ] Creer `components/boardgames/BoardGameTab.tsx` — onglet integrant liste + bouton ajout
- [ ] Ajouter onglet "Jeux" dans EventDetailPage
- [ ] Mettre a jour `.claude/context/FILE_MAP.md`

---

## Session 5 : Tests + polish + mise a jour docs

- [ ] Verifier tous les tests passent (backend + frontend)
- [ ] Mettre a jour `.claude/context/PROGRESS.md` (phase 4 terminee)
- [ ] Mettre a jour `.claude/context/TESTS.md`
- [ ] Mettre a jour `.claude/context/FILE_MAP.md` (final)
