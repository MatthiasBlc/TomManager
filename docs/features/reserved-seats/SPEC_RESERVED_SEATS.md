# Spec : Places reservees par le MJ

## Objectif

Permettre au MJ de bloquer des places sur sa table lors de la creation ou de la gestion.
Ces places reservees ne sont pas accessibles au join normal — le MJ les affecte manuellement
depuis la liste d'attente.

## Modele de donnees

### GameTable

| Champ           | Type | Notes           |
| --------------- | ---- | --------------- |
| `reservedSeats` | Int  | Default 0, >= 0 |

### GameTableParticipant

| Champ              | Type    | Notes                                                       |
| ------------------ | ------- | ----------------------------------------------------------- |
| `isOnReservedSeat` | Boolean | Default false. True si le joueur occupe une place reservee. |

### Enum NotificationType

Valeur ajoutee : `RESERVED_SEAT_ASSIGNED`

## Invariant permanent

`maxPlayers >= confirmedCount + reservedSeats` (openSeats >= 0)

## Regles metier

### Rejoindre une table (join)

```
openSeats = maxPlayers - confirmedCount - reservedSeats
si openSeats > 0 → CONFIRMED (isOnReservedSeat = false)
sinon            → WAITLIST
```

### Promouvoir depuis la waitlist (PATCH status → CONFIRMED)

Priorite : reserved seat d'abord, puis place normale.

```
si reservedSeats > 0 :
  → CONFIRMED, isOnReservedSeat = true, reservedSeats--
  → notification RESERVED_SEAT_ASSIGNED
sinon si openSeats > 0 :
  → CONFIRMED, isOnReservedSeat = false
  → notification WAITLIST_PROMOTED
sinon :
  → 409 "aucune place disponible"
```

### Retrograder (PATCH status → WAITLIST)

```
si participant.isOnReservedSeat :
  → isOnReservedSeat = false, reservedSeats++
→ WAITLIST, notification WAITLIST_DEMOTED
```

### Quitter / etre kicte (leave / kick)

```
si participant.isOnReservedSeat :
  → reservedSeats++   // place retourne dans le pool
  // pas d'auto-promotion
sinon :
  → auto-promotion du premier en waitlist (place normale)
```

### Modifier reservedSeats (updateTable)

```
N = min(N, maxPlayers)
targetConfirmed = max(0, maxPlayers - N)
toDemote = max(0, confirmedCount - targetConfirmed)

// Ordre demotion : non-reserved first (plus recent en premier), puis reserved
// isOnReservedSeat = false sur chaque demote

si N < current : pas d'auto-promotion (decision B)
si N > current : demotions si necessaire

reservedSeats = N
```

### Modifier maxPlayers (updateTable)

```
newReservedSeats = min(reservedSeats, newMaxPlayers)
targetConfirmed = max(0, newMaxPlayers - newReservedSeats)
toDemote = max(0, confirmedCount - targetConfirmed)

// Ordre demotion : non-reserved first (plus recent en premier), puis reserved
// Pas d'auto-promotion si augmentation (decision B)

reservedSeats = newReservedSeats
maxPlayers = newMaxPlayers
```

## API

Aucun nouvel endpoint. Champs ajoutes aux payloads existants :

| Endpoint                                      | Ajout                                        |
| --------------------------------------------- | -------------------------------------------- |
| `POST /tables`                                | Body: `reservedSeats?` (default 0)           |
| `PATCH /:tableId`                             | Body: `reservedSeats?`, `maxPlayers` updated |
| `POST /:tableId/join`                         | Calcul openSeats avec reservedSeats          |
| `PATCH /:tableId/participants/:userId/status` | Logique priorite reserved                    |
| `DELETE /:tableId/leave`                      | isOnReservedSeat → reservedSeats++           |
| `DELETE /:tableId/participants/:userId`       | idem                                         |

Responses enrichies :

- `getTable` : expose `reservedSeats` + `isOnReservedSeat` par participant
- `listTables` : expose `reservedSeats` par table

## Notifications

| Type                     | Quand                                                |
| ------------------------ | ---------------------------------------------------- |
| `WAITLIST_PROMOTED`      | Promotion vers place normale                         |
| `WAITLIST_DEMOTED`       | Demotion vers waitlist                               |
| `RESERVED_SEAT_ASSIGNED` | Affectation a une place reservee par le MJ (nouveau) |

## UI

- `CreateTableModal` / `EditTableModal` : champ "Places reservees" via un composant
  `NumberStepper` (+/-), plafonne dynamiquement a la valeur de "Joueurs max"
  (impossible de creer un etat invalide depuis l'UI). Texte d'aide explicitant
  que ces places ne sont pas accessibles a l'inscription publique.
- `EditTableModal` : encart d'occupation actuelle (confirmes/reserves/waitlist) et
  avertissement + confirmation avant d'enregistrer un changement qui retrograderait
  des joueurs confirmes.
- `TableDetailModal` (modale de gestion d'une table, ouverte depuis la liste et le
  calendrier) :
  - Repartition des places : "X/Y libres" / "X/Y reservees" (`formatSeatSummary`)
  - Badge "reservee" sur les participants confirmes en place reservee
  - Bouton "Retrograder" dans le bloc confirmes (canEdit)
  - Bouton "Ajouter a la table" / "Affecter (place reservee)" dans le bloc waitlist (canEdit)
- `TableCard` (liste) : badge joueur colore (`badge-warning`) pour les joueurs sur
  place reservee. Le calendrier (`CalendarEventBlock`) reste a l'agregat uniquement
  (cellules trop exigues pour un detail par joueur).
