# ROADMAP - Heure de Paris partout (planning, events, tables)

Spec : `SPEC_PARIS_TIMEZONE.md`. Branche de base : `Developement` -> `feature/paris-timezone-fix`.

Rappel critique (spec, contexte) : des users sont deja en production, les donnees
existantes sont deja correctes (sous l'hypothese navigateurs Paris) -> **aucune
migration/backfill DB**, uniquement rendre le code explicite Paris (jamais
l'ambiant navigateur/serveur). Le changement doit rester invisible pour un user deja
en heure de Paris.

## Modele par lot

| Lot                         | Modele       |
| --------------------------- | ------------ |
| A (utilitaires + tests DST) | **Opus 4.8** |
| B (affichage)               | **Sonnet 5** |
| C (inputs)                  | **Sonnet 5** |
| D (CalendarView)            | **Opus 4.8** |
| E (Docker, defense)         | Haiku 4.5    |
| F (tests e2e)               | **Sonnet 5** |

> Lots A et D concentrent toute la logique DST/fake-UTC delicate (risque production) :
> a garder en Opus. B/C sont mecaniques (remplacement de helpers naifs par les
> helpers Paris deja/nouvellement exposes) : Sonnet suffit. E est trivial.

---

## Lot A - Utilitaires partages + tests DST

- [x] Extraire `getZoneOffsetMs`, `zonedWallClockToUtc`, `zonedYMD`, `TZ` de
      `backend/src/services/kitchenPlanning.ts` vers `backend/src/util/timezone.ts`.
      `kitchenPlanning.ts` importe depuis ce module ; corps de fonctions inchange.
- [x] Verifier que `kitchenPlanning.test.ts` (unit + integration) passent sans
      modification apres l'extraction.
- [x] Ajouter `backend/src/__tests__/unit/timezone.test.ts` (cas aux bornes DST
      2026-03-29 02h->03h et 2026-10-25 03h->02h).
- [x] Ajouter dans `frontend/src/utils/dateTime.ts` : `getZoneOffsetMs`,
      `zonedWallClockToUtc`, `parisWallClockParts`, `parisDateInputValue`,
      `parisTimeInputValue`, `parisDateTimeInputValue`, `parisWallClockToUtcIso`,
      `dateTimeLocalToParisUtcIso`, `dateAndTimeToParisUtcIso`, `toParisFakeUtc`,
      `fromParisFakeUtc`, `parisFakeUtcNow`, `formatFakeUtcDate`.
- [x] Ajouter `frontend/src/__tests__/dateTime.test.ts` : toutes les fonctions
      ci-dessus, memes cas DST, + round-trip `fromParisFakeUtc(toParisFakeUtc(iso)) === iso`.

Modele : **Opus 4.8** | Effort : ~1-2h

## Lot B - Affichage (remplacement mecanique des helpers naifs)

- [x] `TableCard.tsx` (`formatTime` local -> `formatParisTime`).
- [x] `MealSlotCard.tsx` (idem).
- [x] `TableDetailModal.tsx` (`formatDateTime` local -> `formatParisDateTime`).
- [x] `EventDetailPage.tsx` (`formatDate` local -> `formatParisDateTime`).
- [x] `EventListPage.tsx` (idem).
- [x] `ParticipantList.tsx` (`toLocaleDateString("fr-FR")` -> `formatParisDate`).
- [x] `TimelineView.tsx` : `dayLabel` -> `formatParisDate` ; supprimer `dayStartTs`,
      regrouper/trier par `parisDayKey(iso)` au lieu du bucketing par jour local.

Modele : **Sonnet 5** | Effort : ~1h

## Lot C - Saisie (inputs date/heure)

- [x] `CreateEventModal.tsx` : submit -> `dateTimeLocalToParisUtcIso`.
- [x] `EditEventModal.tsx` : prefill -> `parisDateTimeInputValue` (supprime
      `toLocalDatetime`) ; submit -> `dateTimeLocalToParisUtcIso` ; validateur
      "fin apres debut" compare apres conversion Paris (CreateEventModal aussi).
- [x] `CreateTableModal.tsx` : submit -> `dateAndTimeToParisUtcIso`.
- [x] `EditTableModal.tsx` : prefill -> `parisDateInputValue`/`parisTimeInputValue`
      (supprime `toLocalDate`/`toLocalTime`) ; submit -> `dateAndTimeToParisUtcIso`.
- [x] `PlanningTab.tsx` : bornes min/max du date-picker (`eventBounds.*.slice(0, 10)`)
      -> `parisDayKey(...)`.

Modele : **Sonnet 5** | Effort : ~1-2h

## Lot D - CalendarView (FullCalendar, fake-UTC)

- [x] `<FullCalendar>` : ajouter `timeZone="UTC"` + `now={() => parisFakeUtcNow()}`.
- [x] `calEvents` : `start`/`end` (tables + repas) -> `toParisFakeUtc(...)`.
- [x] `initialDate` et `validRange` -> `toParisFakeUtc(...)`.
- [x] `firstTableScrollTime` : `.getHours()/.getMinutes()` locaux ->
      `parisWallClockParts(...)`.
- [x] `handleSelect`/`handleDateClick` : getters locaux -> getters **UTC**
      (`getUTCFullYear` etc.) sur les `Date` fake-UTC renvoyes par FullCalendar.
- [x] `patchTableDates` (drag/resize) : convertir `newStart`/`newEnd` via
      `fromParisFakeUtc` **avant** le payload API et **avant** `findGmOverlap`
      (sinon comparaison fake-UTC vs reel = bug).
- [x] `formatMobileHeader`/`currentDate` : `formatFakeUtcDate(...)`, jamais
      `formatParisDate` directement dessus.
- [x] Verifier `calcNbDays` (aucun changement, ms-only) et `CalendarEventBlock.tsx`
      (aucun changement, `arg.timeText` derive par FullCalendar).

Modele : **Opus 4.8** | Effort : ~2-3h

## Lot E - Docker (defense en profondeur)

- [x] `ENV TZ=UTC` dans `backend/Dockerfile` et `discord-bot/Dockerfile`.
- [x] `TZ=UTC` dans les blocs `environment:` de `docker-compose.yml`,
      `docker-compose.preprod.yml`, `docker-compose.prod.yml`.

Modele : **Haiku 4.5** | Effort : ~15-30min

## Lot F - Tests e2e (regression forte)

- [x] Playwright : projet/test avec `contextOptions: { timezoneId: "America/New_York" }`
      (ou `Pacific/Auckland`) qui cree une table a une heure connue via l'UI, verifie
      via l'API l'instant UTC stocke, puis verifie le meme affichage cote UI.
- [x] Drag/resize d'une table dans `CalendarView` sous ce meme fuseau non-Paris :
      verifier que le resultat persiste est correct en heure de Paris.

Modele : **Sonnet 5** | Effort : ~1h

---

## Definition of done

1. [x] `npm run test:frontend` (386 tests) + `npm run test:backend` (402 tests) passent
       (Lot A/B/C/D + tests existants, aucun ajustement necessaire).
2. [x] `npx playwright test --project=chromium` (13/14, seul echec = `cuisine.spec.ts`,
       preexistant et sans rapport, cf note ci-dessous) + nouveau projet
       `chromium-non-paris` (`timezoneId: America/New_York`, Lot F, 2/2).
3. [ ] Test manuel apres `npm run docker:up:build` : creer event + table a heure precise,
       verifier partout (carte, modale, timeline, calendrier drag/resize, pages event) —
       invisible pour un navigateur deja en heure de Paris. **Reste a faire par
       l'utilisateur** (pas de session navigateur interactive disponible cote agent).

Note : `e2e/cuisine.spec.ts` echoue (attend un bouton "Créer mon repas" retire par le
commit `bb50591` sur `Developement`, anterieur a cette feature) — regression
preexistante sans rapport avec le fuseau horaire, non corrigee ici (hors perimetre).
`e2e/auth.spec.ts` echoue egalement sous le projet `mobile-chrome` (username/logout non
trouves en vue mobile) — meme constat, aucun fichier touche par cette feature.
