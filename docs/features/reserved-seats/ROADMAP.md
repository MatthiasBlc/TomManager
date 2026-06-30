# Roadmap : Places reservees par le MJ

## Statut : Complete

## Etapes

- [x] Migration DB : `reservedSeats` sur `GameTable`, `isOnReservedSeat` sur `GameTableParticipant`, `RESERVED_SEAT_ASSIGNED` dans `NotificationType`
- [x] Service `gameTable.ts` : `createTable`, `joinTable`, `leaveTable`, `kickPlayer`, `setParticipantStatus`, `updateTable`
- [x] Service `participant.ts` : `cascadeRemoveFromTables` gere `isOnReservedSeat`
- [x] Tests backend : 15 nouveaux scenarios dans `gameTable.test.ts`, ajustement du test maxPlayers
- [x] Frontend `CreateTableModal` : champ `reservedSeats`
- [x] Frontend `EditTableModal` : champ `reservedSeats`, pre-remplissage
- [x] Frontend `TableDetailPage` : repartition places, badge reserved, boutons promouvoir/retrograder
- [x] Docs : SPEC + ROADMAP
- [x] Contexte `.claude/` : DB_MODELS.md, TESTS.md mis a jour

## Fichiers modifies

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260630000000_add_reserved_seats/migration.sql`
- `backend/src/services/gameTable.ts`
- `backend/src/services/participant.ts`
- `backend/src/__tests__/integration/gameTable.test.ts`
- `frontend/src/components/planning/CreateTableModal.tsx`
- `frontend/src/components/planning/EditTableModal.tsx`
- `frontend/src/pages/TableDetailPage.tsx`
