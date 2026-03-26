# Roadmap : Phase 6 - Notifications In-App

Spec de reference : [SPEC_NOTIFICATIONS.md](./SPEC_NOTIFICATIONS.md)

---

## Session 1 : Modele DB + Service + Tests unitaires

**Objectif** : Notification persistee en DB, service complet, tests.

- [ ] Migration Prisma : enum `NotificationType`, model `Notification`, index composite
- [ ] `notificationService` : `createNotification`, `createBulkNotifications`, `getNotifications` (cursor), `getUnreadCount`, `markAsRead`, `markAllAsRead`, `deleteNotification`
- [ ] Tests unitaires du service (create, bulk, pagination cursor, mark read/all, ownership, delete)

**Validation** : `npm run test:backend` passe, migration appliquee.

---

## Session 2 : Endpoints REST + Tests integration

**Objectif** : API complete avec auth et pagination.

- [ ] Routes : GET `/`, GET `/unread-count`, PATCH `/:id/read`, PATCH `/read-all`, DELETE `/:id`
- [ ] Controller `notificationController` avec validation (limit, cursor, unread filter)
- [ ] Tests integration : auth requise, pagination cursor, filtre unread, ownership (403), delete
- [ ] Mise a jour `API_MAP.md`

**Validation** : `npm run test:backend` passe, endpoints fonctionnels.

---

## Session 3 : Socket.io + Integration services existants

**Objectif** : Notifications emises en temps reel, declenchees par les actions metier.

- [ ] Room personnelle `user:{userId}` : join automatique a la connexion Socket.io
- [ ] Emission `notification:new` dans `createNotification`
- [ ] Integration dans `gameTable` : deleteTable, updateTable (+ promote/demote), leaveTable (promote), kickPlayer (+ promote)
- [ ] Integration dans `participant` : removeParticipant, leaveEvent (admin remove)
- [ ] Tests integration Socket.io : reception `notification:new` sur la bonne room
- [ ] Tests : verification que l'auteur de l'action ne recoit pas de notification

**Validation** : `npm run test:backend` passe, notifications emises en temps reel.

---

## Session 4 : Frontend - Hook + Composants + Tests

**Objectif** : UI complete dans la navbar, notifications temps reel.

- [ ] Hook `useNotifications` : fetch initial, ecoute socket, mark read, mark all, delete, loadMore, unreadCount
- [ ] Composant `NotificationBell` : icone cloche, badge unread, dropdown
- [ ] Composant `NotificationItem` : icone par type, titre, message, timestamp relatif, indicateur non-lu, clic navigation, bouton supprimer
- [ ] Integration dans le layout (navbar)
- [ ] Tests frontend : hook (fetch, socket, mark read), NotificationBell (badge, toggle, mark all), NotificationItem (render, navigation)

**Validation** : `npm run test:frontend` passe, notifications visibles et interactives.

---

## Session 5 : Integration E2E + Mise a jour docs

**Objectif** : Verification complete du flux, polish, documentation.

- [ ] Test du flux complet : action metier -> notification DB -> emission socket -> affichage frontend
- [ ] Verification pagination (scroll infini dans le dropdown)
- [ ] Edge cases : utilisateur deconnecte puis reconnecte (recoit les notifs au fetch initial), bulk notifications
- [ ] Mise a jour `.claude/context/` : PROGRESS, DB_MODELS, FILE_MAP, TESTS
- [ ] Mise a jour ROADMAP globale

**Validation** : `npm test` passe (backend + frontend), flux complet fonctionnel.
