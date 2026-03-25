# Spec : Real-Time (Socket.io)

> Mises a jour en direct du planning, participants et jeux via WebSocket.

---

## Objectif

Permettre aux utilisateurs connectes a un event de voir les changements en temps reel sans recharger la page : creation/modification/suppression de tables, joueurs qui rejoignent/quittent, et ajout/retrait de jeux.

---

## Architecture

### Transport

- Socket.io sur le meme serveur HTTP Express
- Authentification via cookie de session (partage du session store)
- Reconnexion automatique geree par socket.io-client

### Rooms

| Room             | Usage                                    |
| ---------------- | ---------------------------------------- |
| `event:{eventId}` | Tous les changements lies a cet event   |

Un client rejoint la room quand il navigue vers un event et la quitte en sortant.

---

## Events Socket.io

### Server -> Client (broadcasts dans la room event)

| Event                    | Payload                                    | Declencheur                          |
| ------------------------ | ------------------------------------------ | ------------------------------------ |
| `table:created`          | `{ table }` (objet table complet)          | POST /tables                         |
| `table:updated`          | `{ table }` (objet table complet)          | PATCH /tables/:id                    |
| `table:deleted`          | `{ tableId }`                              | DELETE /tables/:id                   |
| `table:player:joined`    | `{ tableId, participant }`                 | POST /tables/:id/join                |
| `table:player:left`      | `{ tableId, userId }`                      | DELETE /tables/:id/leave             |
| `table:player:kicked`    | `{ tableId, userId }`                      | DELETE /tables/:id/participants/:id  |
| `table:player:promoted`  | `{ tableId, userId }`                      | (automatique apres leave/kick/demote)|
| `table:player:demoted`   | `{ tableId, userId }`                      | PATCH /tables/:id (reduce maxPlayers)|
| `participant:removed`    | `{ userId }`                               | DELETE /participants/:id ou /me      |
| `boardgame:added`        | `{ entry }` (objet EventBoardGame complet) | POST /boardgames                     |
| `boardgame:removed`      | `{ entryId }`                              | DELETE /boardgames/:id               |

### Client -> Server

| Event          | Payload        | Action                          |
| -------------- | -------------- | ------------------------------- |
| `join:event`   | `{ eventId }`  | Rejoindre la room event         |
| `leave:event`  | `{ eventId }`  | Quitter la room event           |

---

## Integration services

Chaque service qui modifie des donnees emet l'event Socket.io correspondant apres la mutation DB reussie. L'emetteur est exclu du broadcast (il a deja la reponse HTTP).

L'instance `io` est rendue accessible via un singleton `getIO()`.

---

## Frontend

### Hooks

- `useSocket()` : connexion/deconnexion globale, singleton
- `useEventSocket(eventId)` : join/leave room, ecoute events, callbacks

### Integration pages

- `PlanningPage` : refetch ou patch local sur table:created/updated/deleted
- `TableDetailPage` : refetch sur player:joined/left/kicked/promoted/demoted
- `BoardGameTab` : refetch sur boardgame:added/removed

### Indicateur de connexion

- `ConnectionStatus` : badge dans la navbar (connected/disconnected/reconnecting)

---

## Tests

### Backend (integration)
- Connexion WebSocket avec session valide
- Rejet connexion sans session
- Join/leave room
- Reception table:created quand un autre utilisateur cree une table
- Reception table:player:joined/left

### Frontend
- useSocket hook lifecycle
- MAJ temps reel des tables
