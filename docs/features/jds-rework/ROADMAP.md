# Roadmap : Refonte JDS

Spec complete : `SPEC_JDS_REWORK.md`

## Ordre d'implementation

```
D (BGG fix)  ──┐
               ├──► A (liaison table ↔ jeu) ──► B (Games enrichi)
C (admin)    ──┘
```

D et C peuvent etre faites en parallele ou dans n'importe quel ordre.
A depend de D (BGG fix doit etre fait avant pour que le selecteur de jeu fonctionne correctement).
B depend de A (les liaisons tables doivent exister pour les afficher).

---

## Sous-feature D : BGG fix auth + UX

**Modele reco : Sonnet 4.6 | Effort : 2-3h**

Prerequis : avoir le `BGG_API_TOKEN` (enregistrement sur boardgamegeek.com/applications/create).

- [ ] Ajouter `BGG_API_TOKEN` dans `env.ts`, `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.preprod.yml`
- [ ] Refactorer `bgg.ts` : bearer header, retry 202 (backoff 2/4/8s), retry unique 429, log 401
- [ ] Warning au demarrage dans `app.ts` si token absent
- [ ] Flag `bggAvailable` dans reponse `GET /api/boardgames/search`
- [ ] Message inline "BGG indisponible" dans `BoardGameSearchInput`
- [ ] `POST /api/boardgames/from-bgg` : fetch complet via `fetchBGGThing` (plus de stub)
- [ ] Sanitisation description (`he`) + normalisation imageUrl (`https://`)
- [ ] Tests unitaires `bgg.test.ts` (scenarios : auth header, no-token, retry 202, 429, 401, parse XML, timeout)
- [ ] Ajouter `BGG_API_TOKEN` dans GitHub Secrets (a faire manuellement)

---

## Sous-feature C : Admin banque de jeux

**Modele reco : Sonnet 4.6 | Effort : 3-4h**

- [ ] Endpoints backend `/api/admin/boardgames` : GET liste paginee, PATCH edit, DELETE avec cascade, POST merge
- [ ] Tests integration : CRUD admin, regles suppression (SET NULL tables, delete EventBoardGame), merge
- [ ] Section admin dans `ProfilePage` (visible ADMIN uniquement, meme pattern que print beta)
- [ ] Composant `AdminBoardGamePanel` : liste/recherche, edit modal, delete avec confirmation impact, merge flow

---

## Sous-feature A : Liaison GameTable ↔ BoardGame

**Modele reco : Sonnet 4.6 | Effort : 3-4h**

- [ ] Migration Prisma : `boardGameId String?` sur `GameTable`, relation `BoardGame.gameTables`
- [ ] Schemas Zod mis a jour (`createTableSchema`, `updateTableSchema`)
- [ ] Service `gameTable.ts` : inclure `boardGame` dans tous les selects
- [ ] Tests integration : creer table avec boardGameId valide / invalide / absent
- [ ] `CreateTableModal` : selecteur jeu (3 modes) positionne en haut, uniquement si type=JDS, pre-remplissage silencieux
- [ ] `EditTableModal` : idem avec jeu pre-selectionne si existant
- [ ] `TableDetailModal` : bloc jeu compact + lien vers `BoardGameDetailModal`
- [ ] `TableCard` : sous-titre / badge nom du jeu

---

## Sous-feature B : Modal detail jeu + Games enrichi

**Modele reco : Sonnet 4.6 | Effort : 3-4h**

- [ ] Backend : enrichir `GET /api/events/:id/boardgames` avec `linkedTables: { id, title }[]` par jeu
- [ ] Nouveau composant `BoardGameDetailModal` : image, stats, description, section tables liees
- [ ] `BoardGameCard` cliquable → ouvre `BoardGameDetailModal`
- [ ] Badge "X table(s)" sur `BoardGameCard`
- [ ] Tri et filtres dans `BoardGameTab` (tri par nom / avec table en premier ; filtre avec/sans table)
- [ ] Tests frontend : `BoardGameDetailModal`, `BoardGameCard` cliquable, filtres

---

## Effort total estime

| Sous-feature | Modele     | Effort  |
| ------------ | ---------- | ------- |
| D — BGG fix  | Sonnet 4.6 | 2-3h    |
| C — Admin    | Sonnet 4.6 | 3-4h    |
| A — Liaison  | Sonnet 4.6 | 3-4h    |
| B — Games UI | Sonnet 4.6 | 3-4h    |
| **Total**    |            | 11-15h  |
