# ROADMAP - Heure de Paris partout (planning, events, tables)

Spec : `SPEC_PARIS_TIMEZONE.md`. Branche de base : `Developement` -> `feature/paris-timezone-fix`.

Rappel critique (spec, contexte) : des users sont deja en production, les donnees
existantes sont deja correctes (sous l'hypothese navigateurs Paris) -> **aucune
migration/backfill DB**, uniquement rendre le code explicite Paris (jamais
l'ambiant navigateur/serveur). Le changement doit rester invisible pour un user deja
en heure de Paris.

## Modele par lot

| Lot                       | Modele       |
| -------------------------- | ------------ |
| A (utilitaires + tests DST) | **Opus 4.8** |
| B (affichage)               | **Sonnet 5** |
| C (inputs)                  | **Sonnet 5** |
| D (CalendarView)            | **Opus 4.8** |
| E (Docker, defense)         | Haiku 4.5    |
| F (tests e2e)                | **Sonnet 5** |

> Lots A et D concentrent toute la logique DST/fake-UTC delicate (risque production) :
> a garder en Opus. B/C sont mecaniques (remplacement de helpers naifs par les
> helpers Paris deja/nouvellement exposes) : Sonnet suffit. E est trivial.

---

## Lot A - Utilitaires partages + tests DST

- [ ] Extraire `getZoneOffsetMs`, `zonedWallClockToUtc`, `zonedYMD`, `TZ` de
      `backend/src/services/kitchenPlanning.ts` vers `backend/src/util/timezone.ts`.
      `kitchenPlanning.ts` importe depuis ce module ; corps de fonctions inchange.
- [ ] Verifier que `kitchenPlanning.test.ts` (unit + integration) passent sans
      modification apres l'extraction.
- [ ] Ajouter `backend/src/__tests__/unit/timezone.test.ts` (cas aux bornes DST
      2026-03-29 02h->03h et 2026-10-25 03h->02h).
- [ ] Ajouter dans `frontend/src/utils/dateTime.ts` : `getZoneOffsetMs`,
      `zonedWallClockToUtc`, `parisWallClockParts`, `parisDateInputValue`,
      `parisTimeInputValue`, `parisDateTimeInputValue`, `parisWallClockToUtcIso`,
      `dateTimeLocalToParisUtcIso`, `dateAndTimeToParisUtcIso`, `toParisFakeUtc`,
      `fromParisFakeUtc`, `parisFakeUtcNow`, `formatFakeUtcDate`.
- [ ] Ajouter `frontend/src/__tests__/dateTime.test.ts` : toutes les fonctions
      ci-dessus, memes cas DST, + round-trip `fromParisFakeUtc(toParisFakeUtc(iso)) === iso`.

Modele : **Opus 4.8** | Effort : ~1-2h

## Lot B - Affichage (remplacement mecanique des helpers naifs)

- [ ] `TableCard.tsx` (`formatTime` local -> `formatParisTime`).
- [ ] `MealSlotCard.tsx` (idem).
- [ ] `TableDetailModal.tsx` (`formatDateTime` local -> `formatParisDateTime`).
- [ ] `EventDetailPage.tsx` (`formatDate` local -> `formatParisDateTime`).
- [ ] `EventListPage.tsx` (idem).
- [ ] `ParticipantList.tsx` (`toLocaleDateString("fr-FR")` -> `formatParisDate`).
- [ ] `TimelineView.tsx` : `dayLabel` -> `formatParisDate` ; supprimer `dayStartTs`,
      regrouper/trier par `parisDayKey(iso)` au lieu du bucketing par jour local.

Modele : **Sonnet 5** | Effort : ~1h

## Lot C - Saisie (inputs date/heure)

- [ ] `CreateEventModal.tsx` : submit -> `dateTimeLocalToParisUtcIso`.
- [ ] `EditEventModal.tsx` : prefill -> `parisDateTimeInputValue` (supprime
      `toLocalDatetime`) ; submit -> `dateTimeLocalToParisUtcIso` ; validateur
      "fin apres debut" compare apres conversion Paris (CreateEventModal aussi).
- [ ] `CreateTableModal.tsx` : submit -> `dateAndTimeToParisUtcIso`.
- [ ] `EditTableModal.tsx` : prefill -> `parisDateInputValue`/`parisTimeInputValue`
      (supprime `toLocalDate`/`toLocalTime`) ; submit -> `dateAndTimeToParisUtcIso`.
- [ ] `PlanningTab.tsx` : bornes min/max du date-picker (`eventBounds.*.slice(0, 10)`)
      -> `parisDayKey(...)`.

Modele : **Sonnet 5** | Effort : ~1-2h

## Lot D - CalendarView (FullCalendar, fake-UTC)

- [ ] `<FullCalendar>` : ajouter `timeZone="UTC"` + `now={() => parisFakeUtcNow()}`.
- [ ] `calEvents` : `start`/`end` (tables + repas) -> `toParisFakeUtc(...)`.
- [ ] `initialDate` et `validRange` -> `toParisFakeUtc(...)`.
- [ ] `firstTableScrollTime` : `.getHours()/.getMinutes()` locaux ->
      `parisWallClockParts(...)`.
- [ ] `handleSelect`/`handleDateClick` : getters locaux -> getters **UTC**
      (`getUTCFullYear` etc.) sur les `Date` fake-UTC renvoyes par FullCalendar.
- [ ] `patchTableDates` (drag/resize) : convertir `newStart`/`newEnd` via
      `fromParisFakeUtc` **avant** le payload API et **avant** `findGmOverlap`
      (sinon comparaison fake-UTC vs reel = bug).
- [ ] `formatMobileHeader`/`currentDate` : `formatFakeUtcDate(...)`, jamais
      `formatParisDate` directement dessus.
- [ ] Verifier `calcNbDays` (aucun changement, ms-only) et `CalendarEventBlock.tsx`
      (aucun changement, `arg.timeText` derive par FullCalendar).

Modele : **Opus 4.8** | Effort : ~2-3h

## Lot E - Docker (defense en profondeur)

- [ ] `ENV TZ=UTC` dans `backend/Dockerfile` et `discord-bot/Dockerfile`.
- [ ] `TZ=UTC` dans les blocs `environment:` de `docker-compose.yml`,
      `docker-compose.preprod.yml`, `docker-compose.prod.yml`.

Modele : **Haiku 4.5** | Effort : ~15-30min

## Lot F - Tests e2e (regression forte)

- [ ] Playwright : projet/test avec `contextOptions: { timezoneId: "America/New_York" }`
      (ou `Pacific/Auckland`) qui cree une table a une heure connue via l'UI, verifie
      via l'API l'instant UTC stocke, puis verifie le meme affichage cote UI.
- [ ] Drag/resize d'une table dans `CalendarView` sous ce meme fuseau non-Paris :
      verifier que le resultat persiste est correct en heure de Paris.

Modele : **Sonnet 5** | Effort : ~1h

---

## Definition of done

1. `npm run test:frontend` + `npm run test:backend` passent (Lot A/B/C/D + tests
   existants ajustes si besoin : `CreateEventModal.test.tsx`, `EditEventModal.test.tsx`,
   `CreateTableModal.test.tsx`, `EditTableModal.test.tsx`, `TableCard.test.tsx`,
   `TableDetailModal.test.tsx`, `EventDetailPage.test.tsx`, `EventListPage.test.tsx`,
   `TimelineView.test.tsx`, `ParticipantList.test.tsx`).
2. `npx playwright test --project=chromium` + nouveau test `timezoneId` non-Paris (Lot F).
3. Test manuel apres `npm run docker:up:build` : creer event + table a heure precise,
   verifier partout (carte, modale, timeline, calendrier drag/resize, pages event) —
   invisible pour un navigateur deja en heure de Paris.
