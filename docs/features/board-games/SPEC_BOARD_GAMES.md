# Spec : Board Games (Jeux de societe)

> Integration API BoardGameGeek (BGG), cache local, gestion des jeux par event.

---

## Objectif

Permettre aux participants d'un event de declarer les jeux de societe qu'ils amenent. Recherche via l'API BGG avec cache local, possibilite de creation manuelle.

---

## Modeles de donnees

### BoardGame

| Champ          | Type     | Contraintes                | Notes                        |
| -------------- | -------- | -------------------------- | ---------------------------- |
| id             | UUID     | PK                         |                              |
| name           | String   | required                   |                              |
| externalSource | String?  | nullable                   | Ex: "BGG"                    |
| externalId     | String?  | nullable                   | ID sur la source externe     |
| yearPublished  | Int?     | nullable                   |                              |
| minPlayers     | Int?     | nullable                   |                              |
| maxPlayers     | Int?     | nullable                   |                              |
| playingTime    | Int?     | nullable                   | En minutes                   |
| description    | String?  | nullable                   | Peut contenir du HTML        |
| imageUrl       | String?  | nullable                   | URL de l'image               |
| createdAt      | DateTime | default now()              |                              |

**Contrainte unique partielle :** `(externalSource, externalId)` WHERE both NOT NULL
**Index :** `(name)`

**Regles :**
- Entrees manuelles : `externalSource` et `externalId` sont NULL, pas de contrainte d'unicite (doublons OK)
- Cache depuis l'API BGG au premier fetch, jamais re-fetche apres
- Sert a la fois de cache API et de source d'autocomplete

### EventBoardGame

| Champ           | Type     | Contraintes       | Notes                       |
| --------------- | -------- | ----------------- | --------------------------- |
| id              | UUID     | PK                |                             |
| eventId         | UUID     | FK -> Event.id    |                             |
| boardGameId     | UUID     | FK -> BoardGame.id|                             |
| broughtByUserId | UUID     | FK -> User.id     |                             |
| createdAt       | DateTime | default now()     |                             |

**Contrainte unique :** `(eventId, boardGameId, broughtByUserId)` — un meme utilisateur ne peut pas amener le meme jeu deux fois au meme event. Deux utilisateurs differents peuvent amener le meme jeu.

**Index :** `(eventId)`

**Regles :**
- 1 exemplaire par entree (pas de champ quantite pour le MVP)
- Seuls les participants de l'event peuvent ajouter des jeux
- Suppression d'un participant -> cascade delete de ses EventBoardGame

---

## Endpoints API

### Board Games (`/api/boardgames`)

| Method | Path              | Auth        | Description                          |
| ------ | ----------------- | ----------- | ------------------------------------ |
| GET    | `/search?q=`      | requireAuth | Recherche (local + fallback BGG)     |
| GET    | `/:boardGameId`   | requireAuth | Detail (lazy fetch BGG si stub)      |
| POST   | `/`               | requireAuth | Creation manuelle                    |

### Event Board Games (`/api/events/:eventId/boardgames`)

| Method | Path        | Auth                                  | Description                    |
| ------ | ----------- | ------------------------------------- | ------------------------------ |
| POST   | `/`         | requireAuth + requireEventParticipant | Ajouter un jeu a l'event       |
| GET    | `/`         | requireAuth + requireEventParticipant | Lister les jeux de l'event     |
| DELETE | `/:id`      | requireAuth + requireEventParticipant | Retirer un jeu de l'event      |

---

## Service BGG (BoardGameGeek API)

Client HTTP pour l'API XML BGG v2 :
- **Recherche** : `GET https://boardgamegeek.com/xmlapi2/search?query={q}&type=boardgame`
- **Detail** : `GET https://boardgamegeek.com/xmlapi2/thing?id={id}&stats=1`

Comportement :
- Parser XML -> JSON
- Gestion timeout (5s) et retry (1 retry)
- Recherche : d'abord chercher en local (ILIKE sur name), puis compléter avec BGG si < 10 resultats
- Detail : si BoardGame existe en local avec toutes les infos, retourner le cache. Sinon fetch BGG, creer/update le BoardGame local

---

## Logique metier

### Recherche (`GET /api/boardgames/search?q=`)
1. Chercher en local : `BoardGame WHERE name ILIKE %q%` (limit 10)
2. Si < 10 resultats locaux : appeler BGG search API
3. Fusionner resultats (dedup par externalId), local prioritaire
4. Retourner max 20 resultats

### Detail (`GET /api/boardgames/:boardGameId`)
1. Chercher en local
2. Si BoardGame a `externalSource = "BGG"` et `description IS NULL` (stub) : fetch BGG thing API, enrichir le record local
3. Retourner le BoardGame complet

### Creation manuelle (`POST /api/boardgames`)
- `name` obligatoire, reste optionnel
- `externalSource` et `externalId` restent NULL

### Ajout a l'event (`POST /api/events/:eventId/boardgames`)
- Body : `{ boardGameId }` (le BoardGame doit exister)
- Verif : participant de l'event
- Verif : contrainte unique `(eventId, boardGameId, broughtByUserId)` -> 409 si doublon

### Retrait de l'event (`DELETE /api/events/:eventId/boardgames/:id`)
- Le owner (broughtByUserId) ou un ADMIN peut supprimer
- Non-owner non-admin -> 403

### Cascade retrait participant
- Quand un participant quitte ou est retire d'un event : supprimer tous ses EventBoardGame pour cet event

---

## Frontend

### Composants

| Composant              | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `BoardGameTab`         | Onglet sur EventDetailPage — liste des jeux           |
| `BoardGameSearchInput` | Autocomplete, cherche local puis BGG                  |
| `BoardGameCard`        | Carte jeu (image, nom, annee, joueurs)                |
| `BoardGameList`        | Liste groupee par jeu, montre qui l'amene             |
| `AddBoardGameModal`    | Modal d'ajout de jeu a l'event                        |
| `ManualBoardGameForm`  | Formulaire creation manuelle (dans le modal)          |

### Integration EventDetailPage

Ajouter un onglet "Jeux" dans EventDetailPage, apres l'onglet "Planning".

---

## Tests

### Backend (integration)
- Recherche board game (resultats locaux, fallback BGG, cache)
- Creation manuelle (happy path, validation name requis)
- Ajout a l'event (happy path, doublon -> 409, non-participant -> 403)
- Retrait (owner OK, admin OK, non-owner -> 403)
- Parsing XML BGG (mock API responses)
- Detail avec lazy fetch BGG (stub enrichi)
- Cascade retrait participant inclut board games

### Frontend
- BoardGameSearchInput autocomplete
- BoardGameList affichage et groupement
- AddBoardGameModal validation
