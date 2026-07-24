# Roadmap - Notifications v2 (juillet 2026)

Reference : `SPEC_NOTIFICATIONS_V2.md`. Application en production : chaque lot est
deployable seul, dans l'ordre, sans regression (details section 7 de la spec).

Branche par lot : `feature/notifications-v2-<lot>` depuis `Developement`.

---

## Lot A - Sync multi-appareils + fixes UX (Sonnet 5, ~2-3h) — PRIORITAIRE

Le bug reporte par les utilisateurs + les impasses au clic. Aucune migration.

| #   | Point                                                       | Ref spec | Effort |
| --- | ----------------------------------------------------------- | -------- | ------ |
| 1   | Emissions socket read / read-all / deleted + handlers front | B1       | ~1h30  |
| 2   | Fermeture du panneau au clic sur une notification           | B2       | ~15min |
| 3   | Table de routage par type (fix impasse PARTICIPANT_REMOVED) | B3, S4   | ~30min |
| 4   | Dedoublonnage notification:new par id                       | B6       | ~15min |
| 5   | createNotification non bloquant (try/catch + log)           | B4       | ~30min |

## Lot B - Notifications MJ (Sonnet 5, ~2-3h)

Migration additive enum (GM_PLAYER_JOINED, GM_PLAYER_WAITLISTED, GM_PLAYER_LEFT,
GM_TABLE_FULL) + call-sites joinTable/leaveTable + icones front + tests.

| #   | Point                                                                 | Ref spec | Effort |
| --- | --------------------------------------------------------------------- | -------- | ------ |
| 6   | Migration enum + notifs GM join/waitlist/left                         | S3.1     | ~1h30  |
| 7   | GM_TABLE_FULL (detection derniere place)                              | S3.1     | ~30min |
| 8   | MJ notifie quand un admin modifie/supprime sa table (types existants) | S3.1     | ~30min |
| 9   | Icones + tests front des nouveaux types                               | S3.1, S4 | ~30min |

## Lot C - Notifications event (Sonnet 5, ~1-2h)

Cablage des types morts EVENT_UPDATED / EVENT_DELETED (aucune migration,
valeurs deja dans l'enum).

| #   | Point                                                           | Ref spec | Effort |
| --- | --------------------------------------------------------------- | -------- | ------ |
| 10  | EVENT_UPDATED sur champs significatifs (+ socket event:updated) | S3.2     | ~45min |
| 11  | EVENT_DELETED avant cascade (+ socket event:deleted)            | S3.2     | ~45min |

## Lot D - Retention (Haiku 4.5, ~30min-1h)

| #   | Point                                          | Ref spec | Effort |
| --- | ---------------------------------------------- | -------- | ------ |
| 12  | Job quotidien : purge lues >30j, non lues >90j | S5       | ~45min |

## Lot E - E2E notifications (Sonnet 5, ~1-2h)

| #   | Point                                                                    | Ref spec | Effort |
| --- | ------------------------------------------------------------------------ | -------- | ------ |
| 13  | Scenario e2e temps reel a deux contextes (join -> notif -> clic -> sync) | S8       | ~1h30  |

## Lot F - Optionnel / a confirmer a l'usage

| #   | Point                                                 | Modele    | Effort | Condition                         |
| --- | ----------------------------------------------------- | --------- | ------ | --------------------------------- |
| 14  | Preferences d'opt-out notif.gmActivity / eventChanges | Sonnet 5  | ~1-2h  | Si volume genant apres lots B/C   |
| 15  | TABLE_CREATED broadcast (opt-in uniquement)           | Sonnet 5  | ~1h    | Necessite #14                     |
| 16  | MJ notifie d'un kick/promote/demote fait par un admin | Haiku 4.5 | ~30min | Si le besoin remonte (rare)       |
| 17  | Rappel "table commence bientot" (scheduler)           | Opus 4.8  | ~3-4h  | Chantier separe (cron + timezone) |
| 18  | Web Push navigateur                                   | Opus 4.8  | 8h+    | Hors scope, gros chantier         |

---

## Suivi

- [x] Lot A (2026-07-17 — sync multi-appareils verifiee en runtime sur le stack Docker, 282 tests backend + 300 front OK)
- [x] Lot B (2026-07-17 — migration enum GM\_\*, notifs MJ join/waitlist/left/full, MJ prevenu des updates/deletes admin)
- [x] Lot C (2026-07-17 — EVENT_UPDATED nom/dates + EVENT_DELETED, auteur exclu, emissions socket event:updated/deleted)
- [x] Lot D (2026-07-17 — job quotidien de retention, lues >30j / non lues >90j)
- [x] Lot E (2026-07-17 — e2e temps reel : notif MJ live, clic -> modale + fermeture panneau, sync badge entre onglets ; 13/13 e2e, 294 backend, 300 front)
- [ ] Lot F (a discuter — preferences opt-out, TABLE_CREATED opt-in, notif MJ des kicks admin, rappels, web push)
