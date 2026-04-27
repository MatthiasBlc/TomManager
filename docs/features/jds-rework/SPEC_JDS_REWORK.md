# Spec : Refonte JDS — banque de jeux, BGG et liaisons tables

## IMPORTANT : Points a resoudre avant de commencer

Les questions suivantes n'ont pas encore de reponse arretee. **Ne pas demarrer l'implementation
avant de les avoir toutes tranchees.** Les integrer dans la spec avant de coder.

---

**Point 1 — Redondance Phase 14 / Sous-feature D**

La Phase 14 (BGG fix) est toujours documentee comme entree separee dans `docs/NEXT_STEPS.md`.
La Sous-feature D la couvre entierement.
> Decider : supprimer Phase 14 et laisser D comme unique reference, ou garder les deux avec une note de cross-reference explicite ?

**Point 2 — Pre-remplissage : changement de jeu en cours de saisie**

Si l'utilisateur selectionne le jeu A (qui pre-remplit `maxPlayers: 6`), puis change pour le jeu B
(avec `maxPlayers: 4`) — on ecrase la valeur deja pre-remplie ? On laisse l'utilisateur maitre ?
> Decider : le pre-remplissage est-il one-shot (au premier select uniquement) ou reactif a chaque changement de jeu ?

**Point 3 — UX du merge doublons (Sous-feature C)**

La spec dit "selectionner 2 jeux" sans decrire le flux UI concret.
> Decider : double-select dans la liste ? Bouton "Merger avec..." contextuel sur chaque ligne ? Autre ?

**Point 4 — Source des donnees tables dans BoardGameTab (Sous-feature B)**

Pour afficher les badges "X table(s)" sur chaque jeu, `BoardGameTab` a besoin des tables JDS de
l'event. La spec propose d'enrichir `GET /api/events/:id/boardgames` cote backend, mais ne precise
pas le comportement si les tables ne sont pas encore chargees.
> Decider : appel supplementaire dans `BoardGameTab` ? Props injectees depuis le parent ? Chargement dans le endpoint boardgames ?

**Point 5 — `TableCard` et acces au champ `boardGame`**

`TableCard` est rendu dans `PlanningTab` et `TimelineView`. Les donnees viennent de
`GET /api/events/:id/tables`. Ce endpoint devra inclure `boardGame` dans sa reponse pour que
`TableCard` puisse afficher le nom du jeu.
> Verifier que tous les selects Prisma du service `gameTable.ts` (findMany inclus) retournent bien `boardGame`, et que les types TS correspondants sont mis a jour.

---

## Vue d'ensemble

Quatre sous-features independantes mais liees, a implementer dans l'ordre logique dev :

| ID  | Sous-feature                       | Depends de |
| --- | ---------------------------------- | ---------- |
| A   | Liaison GameTable ↔ BoardGame      | —          |
| B   | Modal detail jeu + Games enrichi   | A          |
| C   | Admin banque de jeux               | —          |
| D   | BGG fix auth + UX                  | —          |

---

## Sous-feature A : Liaison GameTable ↔ BoardGame

### Decisions cles

- **Cardinalite** : 1 table JDS → 0 ou 1 jeu (`boardGameId` nullable sur `GameTable`)
- **Scope** : n'importe quel jeu de la banque globale (pas limite a l'event)
- **Champ optionnel** : le createur peut ignorer la liaison, mettre un titre seul, ou lier un jeu
- **onDelete** : SET NULL — si le jeu est supprime, la table conserve son titre/contenu mais perd la liaison
- **Pre-remplissage** : si un jeu est selectionne ET que `maxPlayers`/duree ne sont pas encore remplis, pré-remplir depuis les donnees du jeu

### Migration DB

```prisma
model GameTable {
  // ... champs existants ...
  boardGameId    String?    // NOUVEAU
  boardGame      BoardGame? @relation(fields: [boardGameId], references: [id], onDelete: SetNull)
}

model BoardGame {
  // ... champs existants ...
  gameTables     GameTable[] // NOUVEAU (relation inverse)
}
```

Une migration Prisma est necessaire.

### Backend

**Schemas Zod (`gameTable.ts`) :**
- `createTableSchema` : ajouter `boardGameId: z.string().uuid().optional()`
- `updateTableSchema` : idem

**Service `gameTable.ts` :**
- Inclure `boardGame: { select: { id, name, yearPublished, minPlayers, maxPlayers, playingTime, imageUrl } }` dans tous les `findUnique` / `findMany`

**Controllers / routes :** aucun changement de signature — les endpoints existants suffisent.

### Frontend — CreateTableModal

Le selecteur de jeu apparait **uniquement quand type = JDS**, positionne **en haut du formulaire** (avant pitch/triggers/comments).

**3 modes pour le champ "Jeu" :**

1. **Rechercher dans la banque** : input autocomplete → `GET /api/boardgames/search?q=` (local + BGG)
2. **Creer manuellement** : ouvre `ManualBoardGameForm` → `POST /api/boardgames` → selectionne le jeu cree
3. **Pas de jeu** (defaut) : ignorer la liaison

**Pre-remplissage :**
- Quand un jeu est selectionne : si `maxPlayers` est vide → pre-remplir avec `game.maxPlayers`
- Si duree est vide → pré-remplir avec `game.playingTime` (converti en option de duree la plus proche)
- Si les champs sont deja remplis par l'utilisateur : ne pas ecraser

**Maquette logique du formulaire JDS :**
```
[Titre]
[Type : JDR / JDS*]
--- (visible uniquement si JDS) ---
[Jeu associe]
  [ Rechercher... ] ou [ Creer manuellement ] ou [ Ignorer ]
  → jeu selectionne : badge avec nom + bouton clear
  → pre-remplissage silencieux de maxPlayers / duree
---
[Pitch] [Triggers] [Commentaires]
[Joueurs max] [Date] [Heure] [Duree]
[Tags]
```

### Frontend — EditTableModal

Meme logique que CreateTableModal. Afficher le jeu actuellement lie (s'il existe) avec possibilite de changer ou de retirer la liaison.

### Frontend — TableDetailModal

Si `table.boardGame` est present :
- Afficher un bloc compact : image miniature (si disponible) + nom du jeu + stats (joueurs, duree)
- Bouton ou lien cliquable "Voir le jeu" → ouvre `BoardGameDetailModal` (sous-feature B)

Placement : apres les meta (type/GM/horaire), avant le pitch.

### Frontend — TableCard

Si `table.boardGame` est present : afficher le nom du jeu en sous-titre ou badge sous le titre de la table.

---

## Sous-feature B : Modal detail jeu + Onglet Games enrichi

### BoardGameDetailModal (nouveau composant)

Ouvert depuis :
- Un click sur une `BoardGameCard` dans l'onglet Games
- Le lien "Voir le jeu" dans `TableDetailModal`

**Contenu :**
- Grande image (si `imageUrl` disponible), sinon placeholder
- Nom + annee de publication
- Stats : joueurs min–max, duree en minutes
- Description (texte plain, sanitisee cote backend)
- Section "Tables a cet event" : liste des tables JDS qui jouent ce jeu (si `eventId` passe en prop)
  - Chaque table = nom cliquable → ouvre `TableDetailModal`
  - Si aucune table : "Aucune table organisee pour ce jeu"
- Bouton "Ajouter a l'event" si le jeu n'est pas encore dans l'EventBoardGame (optionnel selon contexte)

**Props :**
```typescript
interface BoardGameDetailModalProps {
  open: boolean;
  onClose: () => void;
  boardGameId: string;
  eventId?: string; // si present, affiche les tables de l'event
}
```

Le composant fetch `GET /api/boardgames/:id` (lazy-fetch BGG si stub) a l'ouverture.

### BoardGameCard (enrichi)

- Cliquable → ouvre `BoardGameDetailModal`
- Badge "X table(s)" si des tables JDS de l'event sont liees a ce jeu

### BoardGameTab (tri et filtres)

**Tri** (select en haut de l'onglet) :
- Par nom A→Z (defaut)
- "Avec table en premier"

**Filtres** (toggle buttons) :
- Tous (defaut)
- Avec table organisee
- Sans table

L'onglet doit recevoir les tables de l'event pour calculer les liaisons cote frontend
(ou le backend les inclut dans `GET /api/events/:id/boardgames`).

**Option backend (recommandee)** : enrichir la reponse `GET /api/events/:id/boardgames` avec un champ
`linkedTables: { id, title }[]` par jeu, calculé a partir de `GameTable.boardGameId`.

---

## Sous-feature C : Admin banque de jeux

### Acces

Section visible uniquement pour les ADMIN, dans la page **Profil** (comme le bouton beta print).
Bouton "Gerer la banque de jeux" → ouvre `AdminBoardGamePanel` (modal fullscreen ou section expandable).

### Liste

- Tableau paginé : nom, source (BGG / manuel), annee, joueurs min–max, duree
- Recherche par nom (filtre local instantane + query backend si besoin)
- Actions par ligne : **Editer**, **Supprimer**
- Action globale : **Merger des doublons** (selectionner 2 jeux)

### Edition

Modal avec champs modifiables :
- `name`, `yearPublished`, `minPlayers`, `maxPlayers`, `playingTime`, `imageUrl`, `description`
- `externalSource` et `externalId` : affichés en read-only (informatif)

### Suppression

**Regles :**
- `GameTable.boardGameId` → SET NULL (la table conserve son contenu, perd la liaison)
- `EventBoardGame` : supprimer les entrees liees (le jeu disparait des events)

**UX :** avant confirmation, afficher l'impact :
> "Ce jeu est reference dans X event(s) et X table(s). La suppression retirera ces liaisons."

### Merge de doublons

Flux :
1. Selectionner le jeu A (doublon a supprimer) et le jeu B (jeu a conserver)
2. Afficher les deux fiches cote a cote pour verification
3. Confirmer → transferer tous les `EventBoardGame` et `GameTable.boardGameId` de A vers B → supprimer A

### Nouveaux endpoints backend

| Method | Path                           | Auth         | Description                       |
| ------ | ------------------------------ | ------------ | --------------------------------- |
| GET    | `/api/admin/boardgames`        | requireAdmin | Liste paginee (q, page, pageSize) |
| PATCH  | `/api/admin/boardgames/:id`    | requireAdmin | Mise a jour champs                |
| DELETE | `/api/admin/boardgames/:id`    | requireAdmin | Suppression avec cascade          |
| POST   | `/api/admin/boardgames/merge`  | requireAdmin | Merge doublon A → B               |

---

## Sous-feature D : BGG — fix auth + UX

### Fix technique (voir aussi Phase 14)

- Ajouter `BGG_API_TOKEN` dans `env.ts`, docker-compose (dev/prod/preprod), `.env.example`
- `bgg.ts` : envoyer `Authorization: Bearer <token>` si token present
- Retry sur 202 (backoff 2s/4s/8s, max 3 tentatives)
- Retry unique sur 429 (respecter `Retry-After` ou 10s)
- Log explicite sur 401, pas de crash
- Warning au demarrage si token absent

### UX — indicateur BGG indisponible

**Ou** : inline dans `BoardGameSearchInput`, sous le champ, visible uniquement quand l'utilisateur tape.

**Comment** : le backend retourne un flag `bggAvailable: boolean` dans la reponse
`GET /api/boardgames/search` (present meme si results est vide).

```json
{
  "data": [...],
  "bggAvailable": false
}
```

Le frontend affiche un message contextuel :
> "Recherche BGG indisponible — resultats locaux uniquement"

### Import from-bgg — fetch complet immediat

`POST /api/boardgames/from-bgg` : au lieu de creer un stub, appeler immediatement `fetchBGGThing(bggId)`
et stocker tous les champs (description sanitisee, imageUrl normalisee, joueurs, duree).

**Consequence** : le lazy-fetch de `getBoardGame` reste utile pour les anciens stubs existants en DB,
mais les nouveaux imports sont complets d'emblee.

### Sanitisation et normalisation (deja specifiee Phase 14)

- Description : decoder les entites HTML (`he`), supprimer les balises
- imageUrl : normaliser `//cdn...` → `https://cdn...`

---

## Definition of done

### Sous-feature A
- [ ] Migration Prisma `boardGameId` nullable sur `GameTable`
- [ ] Schemas Zod mis a jour (create + update)
- [ ] Service gameTable inclut `boardGame` dans les selects
- [ ] `CreateTableModal` : selecteur jeu en haut (JDS uniquement), 3 modes, pre-remplissage
- [ ] `EditTableModal` : idem avec jeu existant pre-selectionne
- [ ] `TableDetailModal` : bloc jeu avec lien → `BoardGameDetailModal`
- [ ] `TableCard` : sous-titre ou badge avec nom du jeu
- [ ] Tests backend : createTable avec boardGameId valide/invalide/absent

### Sous-feature B
- [ ] `BoardGameDetailModal` : image, stats, description, tables liees
- [ ] `BoardGameCard` cliquable → ouvre le modal
- [ ] Badge "X table(s)" sur `BoardGameCard`
- [ ] Tri et filtres dans `BoardGameTab`
- [ ] Backend : `GET /api/events/:id/boardgames` enrichi avec `linkedTables`

### Sous-feature C
- [ ] Endpoints admin CRUD + merge (`/api/admin/boardgames`)
- [ ] Section admin dans ProfilePage
- [ ] `AdminBoardGamePanel` : liste, edit, delete avec confirmation d'impact, merge
- [ ] Tests backend : CRUD admin, regles de suppression, merge

### Sous-feature D
- [ ] `BGG_API_TOKEN` dans tous les env files
- [ ] `bgg.ts` refactoré (bearer, retry 202, retry 429, log 401)
- [ ] Flag `bggAvailable` dans reponse search
- [ ] Message inline dans `BoardGameSearchInput`
- [ ] `POST /api/boardgames/from-bgg` fetch complet (plus de stub)
- [ ] Tests unitaires `bgg.test.ts`
- [ ] Warning demarrage si token absent
