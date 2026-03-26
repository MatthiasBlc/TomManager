# Spec : Notifications In-App

## Objectif

Systeme de notifications persistantes avec delivery temps reel via Socket.io. Chaque utilisateur recoit des notifications personnelles declenchees par les actions des autres utilisateurs sur les events/tables auxquels il participe.

---

## 1. Modele de donnees

### Enum `NotificationType`

```
TABLE_DELETED         # Une table a laquelle tu participais a ete supprimee
TABLE_UPDATED         # Une table a laquelle tu participais a ete modifiee
WAITLIST_PROMOTED     # Tu es passe de waitlist a confirme
WAITLIST_DEMOTED      # Tu es passe de confirme a waitlist (reduction maxPlayers)
PLAYER_KICKED         # Tu as ete expulse d'une table
PARTICIPANT_REMOVED   # Tu as ete retire d'un event
EVENT_UPDATED         # Un event auquel tu participes a ete modifie
EVENT_DELETED         # Un event auquel tu participais a ete supprime
```

### Model `Notification`

| Champ          | Type               | Description                                  |
| -------------- | ------------------ | -------------------------------------------- |
| `id`           | UUID               | PK                                           |
| `userId`       | UUID               | FK -> User (destinataire)                    |
| `type`         | `NotificationType` | Type de notification                         |
| `title`        | String             | Titre court (ex: "Table supprimee")          |
| `message`      | String             | Message descriptif                            |
| `metadata`     | Json?              | Donnees contextuelles (eventId, tableId...)  |
| `read`         | Boolean            | default false                                |
| `readAt`       | DateTime?          | Timestamp de lecture                         |
| `createdAt`    | DateTime           | default now()                                |

**Index** : `(userId, read, createdAt DESC)` pour le listing performant.

---

## 2. API Endpoints

Tous sous `/api/notifications`, auth requise.

| Methode | Route               | Description                        | Response                   |
| ------- | ------------------- | ---------------------------------- | -------------------------- |
| GET     | `/`                 | Liste paginee (cursor-based)       | `{ data, nextCursor }`    |
| GET     | `/unread-count`     | Nombre de non-lues                 | `{ count }`               |
| PATCH   | `/:id/read`         | Marquer une notification comme lue | `{ notification }`        |
| PATCH   | `/read-all`         | Marquer toutes comme lues          | `{ count }` (nb affectees)|
| DELETE  | `/:id`              | Supprimer une notification         | 204                        |

### GET `/` - Parametres query

| Param    | Type    | Default | Description                              |
| -------- | ------- | ------- | ---------------------------------------- |
| `cursor` | string? | -       | ID de la derniere notification recue     |
| `limit`  | number  | 20      | Nombre par page (max 50)                 |
| `unread` | boolean?| -       | Filtrer sur non-lues uniquement          |

---

## 3. Service `notificationService`

### `createNotification(userId, type, title, message, metadata?)`

1. Persiste en DB via Prisma
2. Emet via Socket.io sur la room personnelle `user:{userId}` l'event `notification:new`
3. Retourne la notification creee

### `createBulkNotifications(notifications[])`

Pour les cas ou une action genere plusieurs notifications (ex: suppression de table -> notifier tous les participants). Utilise `createMany` + emit individuel par user.

### `getNotifications(userId, cursor?, limit, unreadOnly?)`

Pagination cursor-based sur `createdAt DESC`. Retourne les notifications + `nextCursor`.

### `getUnreadCount(userId)`

Simple count avec filtre `read: false`.

### `markAsRead(id, userId)`

Met a jour `read: true` et `readAt: now()`. Verifie que la notification appartient bien a l'utilisateur.

### `markAllAsRead(userId)`

`updateMany` sur toutes les notifications non-lues de l'utilisateur. Retourne le count.

### `deleteNotification(id, userId)`

Supprime la notification. Verifie ownership.

---

## 4. Declencheurs (integration dans services existants)

| Service             | Action                         | Type                  | Destinataires                              |
| ------------------- | ------------------------------ | --------------------- | ------------------------------------------ |
| `gameTable`         | `deleteTable`                  | `TABLE_DELETED`       | Tous les participants de la table          |
| `gameTable`         | `updateTable`                  | `TABLE_UPDATED`       | Tous les participants de la table          |
| `gameTable`         | `updateTable` (maxPlayers up)  | `WAITLIST_PROMOTED`   | Joueurs promus                             |
| `gameTable`         | `updateTable` (maxPlayers down)| `WAITLIST_DEMOTED`    | Joueurs retrogrades                        |
| `gameTable`         | `leaveTable` (auto-promote)    | `WAITLIST_PROMOTED`   | Joueur promu                               |
| `gameTable`         | `kickPlayer`                   | `PLAYER_KICKED`       | Joueur expulse                             |
| `gameTable`         | `kickPlayer` (auto-promote)    | `WAITLIST_PROMOTED`   | Joueur promu                               |
| `participant`       | `removeParticipant`            | `PARTICIPANT_REMOVED` | Utilisateur retire                         |
| `participant`       | `leaveEvent` (admin remove)    | `PARTICIPANT_REMOVED` | Utilisateur retire                         |

> **Note** : On ne notifie PAS l'auteur de l'action (ex: si tu quittes une table toi-meme, pas de notif).

---

## 5. Socket.io

### Room personnelle

A la connexion Socket.io, chaque utilisateur rejoint automatiquement `user:{userId}` (en plus des rooms event existantes).

### Events emis (server -> client)

| Event               | Payload                              | Description           |
| ------------------- | ------------------------------------ | --------------------- |
| `notification:new`  | `{ notification: Notification }`     | Nouvelle notification |

---

## 6. Frontend

### `useNotifications` hook

- Charge les notifications au mount (GET `/`)
- Ecoute `notification:new` via Socket.io
- Expose : `notifications`, `unreadCount`, `markAsRead()`, `markAllAsRead()`, `deleteNotification()`, `loadMore()`, `isLoading`

### `NotificationBell` (composant navbar)

- Icone cloche avec badge compteur (unread count)
- Au clic : dropdown avec liste des notifications
- Chaque item : icone par type, titre, message, timestamp relatif, indicateur non-lu
- Clic sur un item : `markAsRead` + navigation vers la ressource concernee (via `metadata`)
- Bouton "Tout marquer comme lu" en haut du dropdown
- Scroll infini dans le dropdown (cursor pagination)

### `NotificationItem` (composant)

- Affiche icone contextuelle selon `type`
- Titre en gras si non-lu
- Timestamp relatif (date-fns `formatDistanceToNow`)
- Clic : marque comme lu + navigue selon metadata (eventId -> page event, tableId -> page event avec table)
- Bouton supprimer (icone X)

---

## 7. Tests

### Backend

- **Unit** : `notificationService` (create, bulk, pagination, mark read, ownership check)
- **Integration** : endpoints REST (auth, pagination cursor, filtres, permissions)
- **Integration** : emission Socket.io sur `notification:new` a la creation

### Frontend

- **Unit** : `useNotifications` hook (fetch, socket listener, mark read)
- **Unit** : `NotificationBell` (badge, dropdown toggle, mark all read)
- **Unit** : `NotificationItem` (render par type, clic navigation)

---

## 8. Regles metier

- Les notifications sont **personnelles** (un user ne voit que les siennes)
- Pas de notification pour ses propres actions
- Pas de soft-delete : suppression physique (les notifications sont ephemeres)
- Pas de limite de retention pour l'instant (a envisager en phase future si volume)
- Le `unreadCount` est rafraichi via Socket.io (pas de polling)
