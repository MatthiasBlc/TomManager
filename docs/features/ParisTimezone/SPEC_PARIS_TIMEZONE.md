# SPEC - Heure de Paris partout (planning, events, tables)

## Contexte / probleme

Le planning (events, tables, repas) doit imperativement raisonner en heure de Paris de
bout en bout : une heure saisie par un user (ex: 16h00) doit rester 16h00 a
l'affichage, pour tout le monde, quel que soit le fuseau du navigateur ou du serveur —
et ce de facon totalement invisible, car des utilisateurs sont deja en production et
voient aujourd'hui des heures qu'ils pensent deja correctes.

Audit du code existant :

- **Le backend est deja correct.** Toutes les routes (`event.ts`, `gameTable.ts`,
  `meal.ts`) font `new Date(isoString)` sur des chaines ISO-8601 deja completes (avec
  offset) -> timezone-agnostique et correct, tant que le frontend envoie un instant
  absolu correct. Seul `backend/src/services/kitchenPlanning.ts` (generation auto des
  creneaux repas) est deja Paris-explicite, via une conversion heure-murale <-> UTC en
  `Intl.DateTimeFormat`, deja testee DST comprise.
- **Le bug est entierement cote frontend.** Les inputs `datetime-local` / `date`+`time`
  sont interpretes dans le fuseau ambiant du navigateur (`new Date(...)`,
  `getTimezoneOffset()`), et l'affichage utilise `toLocaleTimeString`/`toLocaleString`
  sans `timeZone` explicite (ambiant aussi). Ca "marche" aujourd'hui uniquement parce
  que les navigateurs des users sont vraisemblablement configures en heure de Paris
  (encodage et decodage utilisent le meme fuseau ambiant, qui annule l'erreur) —
  fragile, casse des qu'un navigateur/serveur n'est pas en heure de Paris.

Comme les donnees deja stockees representent deja le bon instant Paris (sous cette
hypothese), **aucune migration/backfill DB n'est necessaire** : il s'agit de rendre le
code explicite (toujours Paris, jamais l'ambiant du navigateur/serveur) sans toucher
aux donnees existantes, ce qui garantit l'invisibilite du changement pour les users
actuels.

## Decision d'architecture : CalendarView (FullCalendar)

FullCalendar (`@fullcalendar/react` v6, deja installe) ne supporte nativement (sans le
plugin `moment-timezone`) que `timeZone="local"` ou `"UTC"`. Plutot que d'ajouter
`moment` + `moment-timezone` (poids important, aucune lib de date n'existe encore dans
le repo, philosophie differente du reste du code), on reutilise le pattern deja
existant et deja teste (`Intl.DateTimeFormat`) via une astuce **"fake UTC"** :

- on convertit chaque instant reel en un `Date` dont les getters **UTC** valent
  l'heure murale de Paris (`toParisFakeUtc`) ;
- on configure FullCalendar en `timeZone="UTC"` ;
- on reconvertit les `Date` qu'il renvoie (drag/resize/select/now) via la fonction
  inverse (`fromParisFakeUtc`) avant tout envoi a l'API ou toute comparaison avec un
  instant reel.

Zero nouvelle dependance, coherent avec le reste du code, testable en pur unitaire
(comme `kitchenPlanning.test.ts`).

## 1. Utilitaire partage (backend, refacto non-fonctionnelle)

Extraire `getZoneOffsetMs`, `zonedWallClockToUtc`, `zonedYMD` et `TZ` de
`backend/src/services/kitchenPlanning.ts` (L9, L25-69) vers un nouveau
`backend/src/util/timezone.ts` (convention `util/` deja utilisee pour `db.ts`,
`logger.ts`). `kitchenPlanning.ts` importe depuis ce nouveau module ; corps de
fonctions inchange, donc `kitchenPlanning.test.ts` (unit + integration) doivent passer
sans modification — bonne preuve que l'extraction n'a rien casse.

Aucun mecanisme de code partage frontend/backend n'existe (pas de workspace, pas de
`shared/`) : les fonctions equivalentes sont dupliquees cote frontend, volontairement
minimales.

## 2. Nouvelles fonctions dans `frontend/src/utils/dateTime.ts`

En plus des fonctions Paris deja presentes (`formatParisDate/Time/DateTime`,
`parisDayKey`), ajouter :

- `getZoneOffsetMs`, `zonedWallClockToUtc` — port direct des fonctions backend.
- `parisWallClockParts(iso): {y,mo,d,h,min}` — brique commune (Y/M/D/H/Min vus depuis
  Paris pour un instant UTC donne), via un seul `Intl.DateTimeFormat` + `formatToParts`.
- `parisDateInputValue(iso): "YYYY-MM-DD"` (peut reutiliser `parisDayKey` en interne).
- `parisTimeInputValue(iso): "HH:MM"`.
- `parisDateTimeInputValue(iso): "YYYY-MM-DDTHH:MM"` — remplace le `toLocalDatetime`
  local de `EditEventModal.tsx`.
- `parisWallClockToUtcIso(y, mo, d, h, min): string`.
- `dateTimeLocalToParisUtcIso(value: string): string` — parse une valeur brute
  `datetime-local` et retourne l'ISO UTC correct. Remplace
  `new Date(data.startDateTime).toISOString()` dans Create/EditEventModal.
- `dateAndTimeToParisUtcIso(dateStr, timeStr): string` — meme chose pour les inputs
  `date`+`time` separes (Create/EditTableModal).
- `toParisFakeUtc(iso): Date` — instant reel -> `Date` "fake UTC" (getters UTC = heure
  murale Paris), pour alimenter FullCalendar.
- `fromParisFakeUtc(fakeDate: Date): string` — inverse (lit les getters **UTC**, jamais
  locaux) -> ISO UTC reel, pour reconvertir ce que FullCalendar renvoie.
- `parisFakeUtcNow(): Date` — pour piloter le `now` de FullCalendar (indicateur
  "maintenant").
- `formatFakeUtcDate(fakeDate, opts?)` — formatte un `Date` "fake UTC" en forcant
  `timeZone: "UTC"` explicitement (evite un double-decalage si utilise par erreur avec
  `formatParisDate`).

## 3. Fichiers d'affichage naifs (remplacement mecanique)

Pattern commun : supprimer le helper local naif, importer `formatParisTime` /
`formatParisDate` / `formatParisDateTime` / `parisDayKey` depuis `dateTime.ts`.

- `frontend/src/components/planning/TableCard.tsx` (L14-18, `formatTime` local).
- `frontend/src/components/planning/MealSlotCard.tsx` (L19-20).
- `frontend/src/components/planning/TableDetailModal.tsx` (L363-370).
- `frontend/src/pages/EventDetailPage.tsx` (L100-109).
- `frontend/src/pages/EventListPage.tsx` (L47-54).
- `frontend/src/components/events/ParticipantList.tsx` (L130, L169 — meme categorie de
  bug, `new Date(p.joinedAt).toLocaleDateString("fr-FR")`).
- `frontend/src/components/planning/TimelineView.tsx` : en plus du remplacement
  d'affichage (`dayLabel`, L21-22), corriger le **bucketing par jour** (`dayStartTs`,
  L25-28) qui groupe actuellement par jour calendaire _local_ au lieu de Paris —
  supprimer `dayStartTs`, utiliser `parisDayKey(iso)` comme cle de regroupement/tri
  (string ISO, triable lexicalement).

## 4. Fichiers de saisie (inputs)

- `CreateEventModal.tsx` (L53-54) : `dateTimeLocalToParisUtcIso(data.startDateTime)` /
  `...endDateTime...` au lieu de `new Date(...).toISOString()`.
- `EditEventModal.tsx` : `toLocalDatetime` local (L30-34) -> `parisDateTimeInputValue`
  au prefill (L68-69) ; submit (L108-109) -> `dateTimeLocalToParisUtcIso`. Le
  validateur "fin apres debut" (L169-171, et son equivalent dans CreateEventModal
  L116-118) doit comparer apres conversion Paris (pas les chaines naives) pour rester
  correct au moment exact de la bascule DST.
- `CreateTableModal.tsx` (L147-162) : `new Date(dateAndTimeToParisUtcIso(data.date, data.startTime))`
  au lieu de `new Date(`${data.date}T${data.startTime}`)` ; le reste (calcul de fin via
  duree en ms) ne change pas.
  - Corriger aussi a la source dans `PlanningTab.tsx` (L275-277) :
    `eventBounds.*.slice(0, 10)` prend le jour calendaire **UTC**, pas Paris, pour les
    bornes min/max du date-picker -> remplacer par
    `parisDayKey(eventBounds.startDateTime)` / `parisDayKey(eventBounds.endDateTime)`.
- `EditTableModal.tsx` : `toLocalDate`/`toLocalTime` (L32-44, `getTimezoneOffset()`) au
  prefill (L151-152) -> `parisDateInputValue` / `parisTimeInputValue` ; submit (L220)
  -> meme fix que `CreateTableModal`.

## 5. `frontend/src/components/planning/CalendarView.tsx` (le plus delicat)

- `<FullCalendar ...>` : ajouter `timeZone="UTC"` (absent aujourd'hui -> defaut
  `"local"`, cause racine du bug dans ce composant) et `now={() => parisFakeUtcNow()}`
  (sinon l'indicateur "maintenant" affiche l'heure UTC reelle etiquetee a tort Paris).
- `calEvents` (L192-244) : `start`/`end` des `tableEvents` et `mealEvents` passent par
  `toParisFakeUtc(...)` au lieu des chaines ISO brutes.
- `initialDate` (L314) et `validRange` (L246-252) : meme conversion — facile a
  oublier, sinon ces bornes restent affichees en UTC brut malgre le reste correct.
- `firstTableScrollTime` (L48-59) : remplacer `.getHours()`/`.getMinutes()` (locaux)
  par l'heure/minute Paris via `parisWallClockParts(...)` — ici on ne manipule qu'une
  chaine "HH:MM:SS", pas besoin de fake-UTC.
- `handleSelect`/`handleDateClick` (L167-190) : les `Date` renvoyes par FullCalendar
  sont maintenant "fake UTC" -> remplacer tous les getters locaux
  (`getFullYear/getMonth/getDate/getHours/getMinutes`) par leurs equivalents **UTC**.
- `patchTableDates` (L123-165), appele par `handleEventDrop`/`handleEventResize` :
  convertir `newStart`/`newEnd` (fake UTC) en instants reels via
  `new Date(fromParisFakeUtc(newStart))` / `...newEnd...` **avant** de les utiliser, a
  la fois pour le payload API (ne plus faire `.toISOString()` direct dessus) et pour
  `findGmOverlap` (L61-76), qui sinon comparerait un `Date` fake-UTC a des `Date` reels
  venant de `tablesRef.current` — bug de comparaison sinon introduit par ce refacto.
- `formatMobileHeader` (L261-266) / `currentDate` (set depuis `arg.start` en
  L115-117, egalement fake-UTC) : utiliser `formatFakeUtcDate(...)`, jamais
  `formatParisDate` (qui re-appliquerait un decalage en trop).
- `calcNbDays` (L43-46) : difference en ms de deux instants reels, timezone-agnostique,
  **aucun changement**.
- `CalendarEventBlock.tsx` : `arg.timeText` est derive par FullCalendar lui-meme depuis
  `timeZone` + `start`/`end` -> automatiquement correct une fois le reste cable,
  **aucun changement**.

## 6. Docker (defense en profondeur, non bloquant)

Aucun `TZ` n'est fixe aujourd'hui ; `node:22-alpine` est deja UTC par defaut. Ajouter
`ENV TZ=UTC` explicite dans `backend/Dockerfile` / `discord-bot/Dockerfile` et
`TZ=UTC` dans les blocs `environment:` de `docker-compose.yml` / `.preprod.yml` /
`.prod.yml`. Volontairement **UTC et pas Paris** : ca matche les runners CI et garde
un garde-fou — si un code futur redependait par erreur du fuseau ambiant serveur, ce
serait immediatement visible (au lieu d'etre masque par un serveur "accidentellement"
a l'heure de Paris).

## 7. Tests

- **Frontend unitaire** (nouveau `frontend/src/__tests__/dateTime.test.ts`) : toutes
  les nouvelles fonctions, avec cas aux bornes DST France 2026 (bascule printemps
  2026-03-29 02h->03h, bascule automne 2026-10-25 03h->02h), + round-trip
  `fromParisFakeUtc(toParisFakeUtc(iso)) === iso`.
- **Backend unitaire** : `backend/src/__tests__/unit/timezone.test.ts` (memes cas DST)
  apres extraction du §1.
- **Tests existants a mettre a jour** : `CreateEventModal.test.tsx`,
  `EditEventModal.test.tsx`, `CreateTableModal.test.tsx`, `EditTableModal.test.tsx`,
  `TableCard.test.tsx`, `TableDetailModal.test.tsx`, `EventDetailPage.test.tsx`,
  `EventListPage.test.tsx`, `TimelineView.test.tsx`, `ParticipantList.test.tsx` —
  verifier qu'ils passent toujours (ou ajuster les assertions si elles dependaient du
  fuseau ambiant du runner).
- **Playwright e2e (fortement recommande)** : ajouter un test/projet avec
  `contextOptions: { timezoneId: "America/New_York" }` (fuseau non-Paris, hemisphere
  DST different) qui cree une table a une heure connue via l'UI, verifie via l'API que
  `startDateTime` correspond au bon instant UTC pour l'heure Paris saisie, puis
  verifie que l'UI la reaffiche a la meme heure. Tres fort pouvoir de detection : le CI
  (runner UTC) et les postes dev (probablement Paris) ne revelent jamais ce bug
  autrement.

## Verification (definition of done)

1. `npm run test:frontend` et `npm run test:backend` passent (tests neufs + existants
   ajustes).
2. `npx playwright test --project=chromium` puis le nouveau test/projet
   `timezoneId` non-Paris.
3. Test manuel : `npm run docker:up:build`, creer un event + une table a une heure
   precise, verifier l'affichage partout (carte table, modale detail, timeline, vue
   calendrier drag/resize, page detail/liste event) — doit rester invisible pour un
   navigateur deja configure en heure de Paris.

## Branche

Nouvelle branche `feature/paris-timezone-fix` depuis `Developement` (au moment de la
redaction, `feature/kitchen-permissions-fix` a des modifs non commitees dans
`docs/features/CookV1/` — a committer/stasher avant de changer de branche, sans les
perdre).
