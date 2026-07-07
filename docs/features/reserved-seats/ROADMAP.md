# Roadmap : Places reservees par le MJ

## Statut : Complete

## Round 1 — logique metier

- [x] Migration DB : `reservedSeats` sur `GameTable`, `isOnReservedSeat` sur `GameTableParticipant`, `RESERVED_SEAT_ASSIGNED` dans `NotificationType`
- [x] Service `gameTable.ts` : `createTable`, `joinTable`, `leaveTable`, `kickPlayer`, `setParticipantStatus`, `updateTable`
- [x] Service `participant.ts` : `cascadeRemoveFromTables` gere `isOnReservedSeat`
- [x] Tests backend : 15 nouveaux scenarios dans `gameTable.test.ts`, ajustement du test maxPlayers
- [x] Frontend `CreateTableModal` / `EditTableModal` : champ `reservedSeats`
- [x] Frontend `TableDetailPage` : repartition places, badge reserved, boutons promouvoir/retrograder
- [x] Docs : SPEC + ROADMAP

Le round 1 a ete marque "Complete" alors que la partie UI/ergonomie n'avait en
realite jamais rattrape la logique backend : `TableDetailPage` (le seul endroit
avec le detail par-joueur) n'etait accessible par aucun lien de l'app, et le
composant reellement utilise pour gerer une table (`TableDetailModal`) n'affichait
qu'un agregat sans distinction par joueur.

## Round 2 — ergonomie de gestion (rattrapage)

- [x] Suppression de `TableDetailPage.tsx` (code mort, jamais accessible depuis l'app) et de sa route
- [x] Renommage "publique" -> "libre" dans le wording des places non reservees
- [x] `listTables` expose desormais `isOnReservedSeat` par joueur (deja expose par `getTable`, manquant pour la liste/le calendrier)
- [x] `TableDetailModal` : badge "reservee" par joueur confirme, libelle "Affecter (place reservee)" sur le bouton de promotion quand `reservedSeats > 0`
- [x] `TableCard` : badge joueur colore (`badge-warning`) pour les places reservees
- [x] `EditTableModal` : encart d'occupation actuelle (confirmes/reserves/waitlist) et avertissement + confirmation avant d'enregistrer un changement qui retrograderait des joueurs confirmes
- [x] `CreateTableModal` / `EditTableModal` : champs "Joueurs max" et "Places reservees" remplaces par un composant `NumberStepper` (+/-), qui bloque physiquement `reservedSeats > maxPlayers` au lieu d'un message d'erreur apres coup
- [x] Icone de notification dediee pour `RESERVED_SEAT_ASSIGNED`
- [x] Tests : `EditTableModal.test.tsx` (nouveau), `NumberStepper.test.tsx` (nouveau), extensions `TableDetailModal.test.tsx`, `TableCard.test.tsx`, `NotificationItem.test.tsx`, `gameTable.test.ts` (listTables)

### Hors scope (deliberement non traite)

- Notion de place reservee nominative (assigner a un `userId` precis avant qu'il rejoigne)
- Traduction generalisee des messages d'erreur backend (pattern existant dans toute l'app)
- Race condition potentielle sur `joinTable`/promotion concurrente (preexistante, non specifique a cette feature)
- Badge par-joueur dans `CalendarEventBlock` (cellule de calendrier trop exigue, risque de reintroduire le bug de debordement mobile corrige en `5d82509`)

## Fichiers modifies

**Round 1** :

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260630000000_add_reserved_seats/migration.sql`
- `backend/src/services/gameTable.ts`
- `backend/src/services/participant.ts`
- `backend/src/__tests__/integration/gameTable.test.ts`

**Round 2** :

- `backend/src/services/gameTable.ts` (`listTables`)
- `backend/src/__tests__/integration/gameTable.test.ts`
- `frontend/src/components/planning/TableDetailModal.tsx`
- `frontend/src/components/planning/TableCard.tsx`
- `frontend/src/components/planning/EditTableModal.tsx`
- `frontend/src/components/planning/CreateTableModal.tsx`
- `frontend/src/components/planning/computeLayout.ts`
- `frontend/src/components/common/NumberStepper.tsx` (nouveau)
- `frontend/src/components/notifications/NotificationItem.tsx`
- `frontend/src/routes/AppRoutes.tsx` (suppression de la route `TableDetailPage`)
- `frontend/src/pages/TableDetailPage.tsx` (supprime)
- `frontend/src/__tests__/TableDetailPage.test.tsx` (supprime)
- Tests frontend : `TableDetailModal.test.tsx`, `TableCard.test.tsx`, `EditTableModal.test.tsx` (nouveau), `NumberStepper.test.tsx` (nouveau), `NotificationItem.test.tsx`, `CreateTableModal.test.tsx`
