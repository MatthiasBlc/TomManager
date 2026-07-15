# Spec : Places reservees par le MJ

## Objectif

Permettre au MJ de bloquer des places sur sa table lors de la creation ou de la gestion.
Ces places reservees ne sont pas accessibles au join normal — le MJ les affecte manuellement
depuis la liste d'attente.

## Modele de donnees

### GameTable

| Champ           | Type | Notes                                                                                                                                                    |
| --------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reservedSeats` | Int  | Default 0, >= 0. **Total fixe** configure par le MJ, uniquement mute via `updateTable`. Jamais incremente/decremente par join/promote/demote/leave/kick. |

Le nombre de places reservees encore disponibles se **derive** a la volee et n'est
jamais stocke :

```
confirmedOnReserved = count(participants CONFIRMED ET isOnReservedSeat)
availableReserved    = reservedSeats - confirmedOnReserved
normalCapacity       = maxPlayers - reservedSeats
confirmedNormal      = confirmedCount - confirmedOnReserved
availableNormal      = normalCapacity - confirmedNormal
```

### GameTableParticipant

| Champ              | Type    | Notes                                                       |
| ------------------ | ------- | ----------------------------------------------------------- |
| `isOnReservedSeat` | Boolean | Default false. True si le joueur occupe une place reservee. |

### Enum NotificationType

Valeur ajoutee : `RESERVED_SEAT_ASSIGNED`

## Invariant permanent

`maxPlayers >= confirmedCount + max(0, reservedSeats - confirmedOnReserved)` — en
pratique, deux compartiments etanches : `normalCapacity = maxPlayers - reservedSeats`
pour les places libres, `reservedSeats` pour les places reservees. `reservedSeats`
lui-meme ne bouge jamais suite a une action participant, seulement via `updateTable`.

## Regles metier

### Rejoindre une table (join)

Le join ne prend jamais une place reservee (uniquement le MJ peut l'affecter).

```
availableNormal = normalCapacity - confirmedNormal
si availableNormal > 0 → CONFIRMED (isOnReservedSeat = false)
sinon                  → WAITLIST
```

### Promouvoir depuis la waitlist (PATCH status → CONFIRMED)

Body optionnel `seat: "FREE" | "RESERVED"` pour choisir explicitement le type
de place. Sans `seat` (comportement par defaut, retro-compatible) :
priorite reserved seat d'abord, puis place normale.

```
si seat === "RESERVED" :
  availableReserved > 0 ? CONFIRMED, isOnReservedSeat = true : 409
si seat === "FREE" :
  availableNormal > 0 ? CONFIRMED, isOnReservedSeat = false : 409
si seat absent (defaut) :
  si availableReserved > 0 :
    → CONFIRMED, isOnReservedSeat = true
    → notification RESERVED_SEAT_ASSIGNED
  sinon si availableNormal > 0 :
    → CONFIRMED, isOnReservedSeat = false
    → notification WAITLIST_PROMOTED
  sinon :
    → 409 "aucune place disponible"
```

`reservedSeats` n'est jamais modifie par cette action.

### Convertir un joueur deja confirme (PATCH status → CONFIRMED, seat explicite)

Meme endpoint que la promotion, mais applique quand le participant cible est
deja `CONFIRMED` : permet de basculer un joueur entre place libre et place
reservee sans repasser par la liste d'attente.

```
seat === desiredReserved deja actuel → no-op
FREE -> RESERVED : availableReserved > 0 ? isOnReservedSeat = true : 409
                   notification RESERVED_SEAT_ASSIGNED
RESERVED -> FREE : toujours autorise (le nombre de confirmes ne change pas)
                   isOnReservedSeat = false
                   pas de notification
```

`reservedSeats` n'est jamais modifie par cette action.

### Retrograder (PATCH status → WAITLIST)

```
→ WAITLIST, isOnReservedSeat = false, notification WAITLIST_DEMOTED
```

La place reservee liberee redevient disponible via le calcul derive
(`availableReserved` augmente mecaniquement) — `reservedSeats` (le total) ne bouge pas.

### Quitter / etre kicte (leave / kick)

```
si participant.isOnReservedSeat :
  // place reservee liberee (calcul derive), pas d'auto-promotion
sinon :
  → auto-promotion du premier en waitlist (place normale)
```

### Modifier reservedSeats / maxPlayers (updateTable)

`reservedSeats` est ecrit directement a partir de la valeur envoyee par le MJ
(cappee a `maxPlayers`) — ce n'est plus un pool a ajuster, juste une config.
La reconciliation des joueurs confirmes se fait en deux phases independantes,
dans cet ordre (l'ordre compte : la conversion de la phase 1 consomme de la
place libre evaluee par la phase 2) :

```
normalCapacity = max(0, newMaxPlayers - newReservedSeats)

// Phase 1 — debordement des places reservees (reservedSeats a diminue) :
// le(s) joueur(s) reserve(s) le(s) plus recent(s) sont convertis en place
// libre si la capacite libre le permet, sinon liste d'attente. Entre
// plusieurs candidats en trop, les plus anciens du lot recuperent la
// conversion, les plus recents partent en liste d'attente.
reservedOverflow    = max(0, confirmedOnReserved - newReservedSeats)
availableNormalRoom = max(0, normalCapacity - confirmedNormal)
convertCount        = min(reservedOverflow, availableNormalRoom)
→ convertCount joueurs (les plus anciens du lot en trop) : isOnReservedSeat = false
→ (reservedOverflow - convertCount) joueurs (les plus recents du lot) : WAITLIST

// Phase 2 — debordement des places libres (maxPlayers a diminue ou
// reservedSeats a augmente) : liste d'attente directe, JAMAIS de bascule
// automatique vers une place reservee (decision B — une place reservee est
// toujours affectee a la main par le MJ).
confirmedNormalAfterConversion = confirmedNormal + convertCount
normalOverflow = max(0, confirmedNormalAfterConversion - normalCapacity)
→ normalOverflow joueurs libres les plus recents : WAITLIST

reservedSeats = newReservedSeats
maxPlayers    = newMaxPlayers
```

Pas d'auto-promotion dans un sens ou dans l'autre (decision B).

## Piege historique (corrige)

Premiere implementation : `reservedSeats` stockait le **pool restant non
attribue** (decremente a l'attribution, incremente a la liberation) au lieu
d'un total fixe. Deux consequences en prod :

- L'affichage (`formatSeatSummary`) et le formulaire d'edition traitaient
  `reservedSeats` comme un total, alors qu'il etait deja decremente → chiffres
  faux des qu'une place reservee etait attribuee (ex: 0/1 libre au lieu de
  0/0, 1/1 reservee au lieu de 1/2).
- `updateTable` ecrivait directement la saisie du MJ dans ce pool sans tenir
  compte des places deja attribuees, et comparait `confirmedCount` (total) a
  une capacite normale seule → un joueur deja sur une place reservee pouvait
  se retrouver retrograde en liste d'attente en remettant `reservedSeats` a
  sa valeur d'origine.

Fixe en migrant `reservedSeats` vers un total fixe (jamais mute par les
actions participants) + migration de donnees (`20260715120000_backfill_reserved_seats_total`)
pour corriger les valeurs deja decrementees en prod au moment du deploiement.

## API

Aucun nouvel endpoint. Champs ajoutes aux payloads existants :

| Endpoint                                      | Ajout                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST /tables`                                | Body: `reservedSeats?` (default 0)                                           |
| `PATCH /:tableId`                             | Body: `reservedSeats?`, `maxPlayers` updated                                 |
| `POST /:tableId/join`                         | Calcul openSeats avec reservedSeats                                          |
| `PATCH /:tableId/participants/:userId/status` | Body: `seat?: "FREE" \| "RESERVED"` — choix explicite ou conversion en place |
| `DELETE /:tableId/leave`                      | Place reservee liberee (calcul derive, `reservedSeats` inchange)            |
| `DELETE /:tableId/participants/:userId`       | idem                                                                         |

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
  - Bouton "Retrograder" (vers waitlist) dans le bloc confirmes (canEdit), et bouton de
    conversion en place ("Passer en place reservee" / "Passer en place libre") quand
    l'autre type de place est disponible
  - Bloc waitlist (canEdit) : un seul bouton de promotion ("Ajouter a la table" ou
    "Affecter (place reservee)") quand un seul type de place est libre ; deux boutons
    distincts ("Ajouter (place libre)" et "Affecter (place reservee)") quand les deux
    sont disponibles simultanement, pour laisser le MJ choisir explicitement
- `TableCard` (liste) : badge joueur colore (`badge-warning`) pour les joueurs sur
  place reservee. Le calendrier (`CalendarEventBlock`) reste a l'agregat uniquement
  (cellules trop exigues pour un detail par joueur).
