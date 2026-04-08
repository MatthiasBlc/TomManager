# Roadmap : Phase 6 - Notifications In-App

Spec de reference : [SPEC_NOTIFICATIONS.md](./SPEC_NOTIFICATIONS.md)

---

## Session 1 : Modele DB + Service + Tests unitaires

**Objectif** : Notification persistee en DB, service complet, tests.

- [x] Migration Prisma : enum `NotificationType`, model `Notification`, index composite
- [x] `notificationService` : `createNotification`, `createBulkNotifications`, `getNotifications` (cursor), `getUnreadCount`, `markAsRead`, `markAllAsRead`, `deleteNotification`
- [x] Tests unitaires du service (create, bulk, pagination cursor, mark read/all, ownership, delete)

**Validation** : `npm run test:backend` passe, migration appliquee.

---

## Session 2 : Endpoints REST + Tests integration

**Objectif** : API complete avec auth et pagination.

- [x] Routes : GET `/`, GET `/unread-count`, PATCH `/:id/read`, PATCH `/read-all`, DELETE `/:id`
- [x] Controller `notificationController` avec validation (limit, cursor, unread filter)
- [x] Tests integration : auth requise, pagination cursor, filtre unread, ownership (403), delete
- [x] Mise a jour `API_MAP.md`

**Validation** : `npm run test:backend` passe, endpoints fonctionnels.

---

## Session 3 : Socket.io + Integration services existants

**Objectif** : Notifications emises en temps reel, declenchees par les actions metier.

- [x] Room personnelle `user:{userId}` : join automatique a la connexion Socket.io
- [x] Emission `notification:new` dans `createNotification`
- [x] Integration dans `gameTable` : deleteTable, updateTable (+ promote/demote), leaveTable (promote), kickPlayer (+ promote)
- [x] Integration dans `participant` : removeParticipant
- [x] Tests integration : notification creee lors des actions metier
- [x] Tests : verification que l'auteur de l'action ne recoit pas de notification

**Validation** : `npm run test:backend` passe, notifications emises en temps reel.

---

## Session 4 : Frontend - Hook + Composants + Tests

**Objectif** : UI complete dans la navbar, notifications temps reel.

- [x] Hook `useNotifications` : fetch initial, ecoute socket, mark read, mark all, delete, loadMore, unreadCount
- [x] Composant `NotificationBell` : icone cloche, badge unread, dropdown
- [x] Composant `NotificationItem` : icone par type, titre, message, timestamp relatif, indicateur non-lu, clic navigation, bouton supprimer
- [x] Integration dans le layout (navbar)
- [x] Tests frontend : NotificationBell (badge, toggle, mark all, empty state, load more), NotificationItem (render, navigation, delete)

**Validation** : `npm run test:frontend` passe, notifications visibles et interactives.

---

## Session 5 : Mise a jour docs

**Objectif** : Documentation a jour.

- [x] Mise a jour `.claude/context/` : PROGRESS, DB_MODELS, FILE_MAP, TESTS, API_MAP
- [x] Mise a jour ROADMAP Phase 6 (toutes sessions cochees)
