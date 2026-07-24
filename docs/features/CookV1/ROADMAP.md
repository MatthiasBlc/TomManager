# ROADMAP - Module Cuisine (CookV1)

Spec : `SPEC_COOKING.md`. Branche de base : `Developement` -> `feature/cooking-v1`.

Ordre pense pour livrer par couches testables (DB -> API -> bot -> UI -> conflits -> purge).

**Rappel PROD** (spec 17) : migration 100% additive, aucun ALTER/DROP sur l'existant ;
chown 1003:1003 sur le fichier de migration ; relire le SQL ; jamais `migrate dev` en prod.
**Tests** (spec 16) : chaque lot livre ses tests dans le meme commit ; seuils CI 50%/50%.

## Modele par lot (points de bascule)

| Lot                        | Modele       |
| -------------------------- | ------------ |
| A, B, B-bis, C, D, E       | **Sonnet 5** |
| **F (moteur de conflits)** | **Opus 4.8** |
| G                          | **Sonnet 5** |

> **STOP avant le Lot F** : terminer E en Sonnet 5, PUIS basculer sur **Opus 4.8** pour
> tout le Lot F (moteur de conflits, code planning prod critique), PUIS **revenir a
> Sonnet 5** pour le Lot G. B et C : escalade Opus autorisee mid-course si la logique
> exclusivite/orphelinage se noue (sinon rester en Sonnet 5).

---

## Lot A - Fondations DB & preference

- [x] Migration Prisma **additive** : `EventKitchen`, `KitchenChef`,
      `KitchenCoursesMember`, `Meal`, `MealIngredient`, `Product`, `MealUtensil`,
      `MealAssistant` + enums `ChefSource`, `MealService`,
      `Unit` (G/KG/ML/CL/L/CAS/CAC/PIECE). Uniquement CREATE, aucun ALTER/DROP.
- [x] Ajouter la cle `admin.kitchen` a la liste blanche `schemas/preference.ts`.
- [x] Relire le SQL genere, chown 1003:1003, tester sur la base docker.
- [x] Mettre a jour `.claude/context/DB_MODELS.md`.

Modele : **Sonnet 5** | Effort : ~1-2h

## Lot B - API gestion cuisine (responsable)

- [x] `EventKitchen` get/upsert config (chefRoleId, allergiesNotes, equipierPlanningEnabled).
- [x] Roster chef materialise : add/remove `MANUAL` (participants only) ; retrait d'un
      chef avec repas **orpheline** le repas (chefUserId=null, fiche conservee) ;
      ecrasement `MANUAL` -> `ROLE` au set du chefRoleId (orpheline les non-survivants).
- [x] Equipe courses : assigner/retirer (participants only) + exclusivite
      (`ROLE_EXCLUSIVITY`).
- [x] Liste "sans affectation" + repas orphelins a reassigner.
- [x] GET / **modele par role** (equipier = board sans allergies/ingredients) +
      `currentUserKitchenRole` + etat par defaut si pas d'EventKitchen (pas de 404).
- [x] Middleware `requireKitchenManager` + lecture cuisine (admin/chef/equipier).
- [x] Tests integration (dont exclusivite, blocages, fuite allergies equipier).
- [x] Sync initial du roster ROLE au set du chefRoleId (backend, `fetchAllGuildMembers`,
      best-effort) — avance depuis le Lot B-bis, cf. note ci-dessous.

Modele : **Sonnet 5** | Effort : ~2-3h

## Lot B-bis - Sync bot du roster chef (source ROLE)

Le sync initial backend (au set du chefRoleId) a ete implemente avec le Lot B
(`syncChefRoleRoster` dans `services/kitchen.ts`, reutilise `getLocalUserIdsForDiscordRole`
dans `adminSync.ts`). Reste a faire ici : la synchro **continue** cote discord-bot.

- [x] `guildMemberUpdate` : gain/perte d'un `chefRoleId` -> ajout/retrait `KitchenChef`
      `ROLE` + resolution exclusivite ; contrainte "doit etre participant".
- [x] `startupSync` : reconcilier les rosters `ROLE`.
- [x] Tests bot : `guildMemberUpdate` chef (gain/perte + exclusivite + participant),
      `startupSync` reconciliation.
- [x] `discord-bot/prisma/schema.prisma` resynchronise avec le backend (avait deja
      derive avant CookV1 — meme DB partagee) + `npx prisma generate`.

Modele : **Sonnet 5** | Effort : ~2-3h (calque sur syncParticipation existant)

## Lot C - API fiches repas & inscriptions

- [x] `Meal` CRUD : creation reservee au roster (`NOT_IN_CHEF_ROSTER`), unique 1
      chef/repas (`MEAL_ALREADY_EXISTS`), `chefUserId` **nullable** (orphelin si le chef
      sort du roster), edit chef-owner ou manager, reassignation d'un orphelin par manager.
- [x] Ingredients (autocomplete `Product` calque sur `/api/tags`) + ustensiles.
- [x] `MealAssistant` : s'inscrire / se deplacer (transaction) / quitter ; controle
      capacite (`MEAL_FULL`) + exclusivite (pas chef/courses).
- [x] Tests integration : CRUD repas + auth, orphelinage/reassignation, ingredients
      (find-or-create Product) + ustensiles, inscription/deplacement/capacite,
      deplacement transactionnel (rollback si dest pleine).

Modele : **Sonnet 5** | Effort : ~3-4h

## Lot D - Generation du planning

- [x] Endpoint generation : `base = floor(pool/nbRepas)`, `reste` aux premiers repas ;
      clamp pool<=0 / nbRepas=0. pool = participants - chefs - membres courses.
- [x] Regeneration non destructive (conserve inscriptions, applique la capacite meme si
      sur-occupation, avertit ; join refuse si inscrits >= maxAssistants).
- [x] Tests unitaires du calcul (0 repas, pool negatif, reste, sur-occupation) + integration
      endpoint (pool, tri par startDateTime, exclusion courses, non-destructif, regen x2).

Modele : **Sonnet 5** | Effort : ~2-3h

## Lot E - Temps reel + UI

- [x] Events sockets `kitchen:*` (config / meal / assistant / planning) vers room event
      (extension de `useEventSocket`).
- [x] Onglet Cuisine (`KitchenTab` + `KitchenManagementPanel` + `MealFichesList` +
      `MealFormModal`) selon la matrice de visibilite (spec 4) : responsable (RW),
      admin simple (R via `isAdmin`), chef (RW sa fiche, R les autres), equipier (masque).
- [x] Onglet Info : `KitchenBoard` (board repas + inscription/deplacement/desinscription
      equipier), maj live.
- [x] Modales de confirmation (`useConfirm`) : ecrasement chefs au set du chefRoleId,
      retrait d'un chef, regeneration du planning, suppression d'un repas (avec compte
      equipiers impactes).
- [x] Tests composants (Vitest + Testing Library) : `KitchenTab` (matrice de visibilite),
      `KitchenBoard` (affichage/masquage selon role+toggle, join/move/leave, "sans chef",
      places restantes), `KitchenManagementPanel` (modales de confirmation, roster,
      reassignation), `MealFichesList` (permissions edit/delete, warning equipiers),
      `useEventSocket` (reaction aux 4 evenements `kitchen:*`).

Note : pas de fetch dediee au chargement de l'onglet (chaque composant racine fetche les
siennes, coherent avec `PlanningTab`/`BoardGameTab`). Candidats de "chef manuel"/"equipe
courses" dans `KitchenManagementPanel` limites a la liste `unassigned` (simplification V1 —
promouvoir un equipier/courses deja affecte en chef reste possible cote backend, juste pas
via un menu dedie ; retirer d'abord son role actuel puis l'ajouter fonctionne).

Modele : **Sonnet 5** | Effort : ~5-7h

## Lot F - Integration moteur de conflits (planning)

- [x] Unifier intervalles tables + occupations cuisine (chef sur son repas, equipier sur
      son repas) dans le calcul de `gameTable.ts`. Moteur extrait dans
      `services/conflicts.ts` (`getEventOccupations` + `computeConflicts`), partage entre
      `listTables` (cote tables) et `getKitchenView` (cote repas).
- [x] Surbrillance visible : personne concernee (`currentUserConflict`) + chef/MJ
      (`conflictingCount` / `conflictingPlayerCount`, montre au chef du repas / au MJ).
- [x] Rendu creneaux cuisine dans l'onglet Planning (vue calendrier + vue liste). Le
      PlanningTab fetche les repas via `GET /kitchen` et refetche les DEUX domaines a
      chaque evenement socket `table:*` ou `kitchen:*` (conflits croises).
- [x] Tests unitaires du calcul unifie (`__tests__/unit/conflicts.test.ts`) + integration
      cross-domaine (`__tests__/integration/kitchenConflicts.test.ts`) + composants
      (`TimelineView.test.tsx`). Non-regression : les tests conflits tables existants
      passent toujours.

Modele : **Opus 4.8** | Effort : ~3-5h (touche le coeur du planning, subtil)

## Lot G - E2E, purge & finitions

- [x] E2E Playwright spec `cuisine` (`e2e/cuisine.spec.ts`) : responsable configure
      (equipierPlanningEnabled + chef manuel) -> chef cree un repas -> responsable genere
      le planning (maxAssistants demarre a 0, spec 5) -> equipier s'inscrit au repas puis
      rejoint une table chevauchante -> conflit visible dans Planning (badge "Conflit")
      -> purge (bouton UI + reload) -> repas et chef MANUAL disparus. Nouveau helper
      fixture `enableKitchenManager` (`e2e/fixtures/seed.ts`).
- [x] Purge etendue (`services/event.ts::purgeEvent`) : conserve `EventKitchen` (config
      incluse) + `chefRoleId` ; purge repas (cascade ingredients/ustensiles/inscriptions),
      `KitchenCoursesMember`, chefs `MANUAL` uniquement ; chefs `ROLE` reconstitues via
      `syncChefRoleRoster` une fois les participants re-importes (best-effort). Message de
      confirmation UI (`EditEventModal`) mis a jour. Tests : `kitchenPurge.test.ts`
      (suppression + reconstitution ROLE avec adminSync mocke, aucun appel reseau reel).
- [x] Mise a jour `.claude/context/` (API_MAP, FILE_MAP, TESTS, PROGRESS). DB_MODELS
      inchange (aucune migration dans ce lot).
- [x] Changelog utilisateur (`docs/changelogs/`).

Modele : **Sonnet 5** | Effort : ~2-3h

## Lot H - Notifications cuisine

- [x] 9 types `NotificationType` additifs (migration Prisma) : swap chef
      (requested/accepted/rejected), swap equipier (requested/accepted), roster chef
      (added/removed), reclamation de creneau avec equipiers deja inscrits,
      sur-occupation post-generation. Voir `SPEC_COOKING.md` section 13 pour le detail
      declencheur/destinataire.
- [x] Appels `createNotification`/`createBulkNotifications` dans `mealSwap.ts`,
      `assistantSwap.ts`, `kitchen.ts`, `meal.ts`, `kitchenPlanning.ts`.
- [x] Parite sur la sync continue du roster chef via le bot Discord
      (`discord-bot/src/services/syncKitchenChef.ts`) : ecrit directement la ligne
      `Notification` (pas d'acces au socket backend depuis ce process).
- [x] Frontend : `NotificationItem.tsx` (icones + deep-link `?tab=kitchen`).
- [x] Tests (backend integration, discord-bot, frontend) dans les suites existantes.

Modele : **Sonnet 5** | Effort : ~2-3h

---

## V2 (hors scope, ne pas implementer maintenant)

- Allergies self-service par participant (persistees inter-events).
- Module courses : agregation par `Product`, conversion d'unites par dimension,
  liste de courses generee depuis les ingredients.
