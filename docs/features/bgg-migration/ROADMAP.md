# Roadmap : Migration API BGG (Phase 14)

## Prerequis (avant de coder)

- [ ] **Creer/utiliser un compte BGG** sur `https://boardgamegeek.com`
- [ ] **Enregistrer TomManager** sur `https://boardgamegeek.com/applications/create`
  - Nom : "TomManager"
  - Description : "Event planning tool for tabletop gaming sessions"
- [ ] **Attendre approbation** (generalement < 24h)
- [ ] **Generer le Bearer Token** dans le dashboard BGG
- [ ] **Tester le token manuellement** :
  ```bash
  curl -H "Authorization: Bearer <token>" \
    "https://boardgamegeek.com/xmlapi2/search?query=catan&type=boardgame"
  # Doit retourner du XML avec des resultats, pas 401
  ```

---

## Etape 1 — Configuration environnement

**Fichiers** : `env.ts`, `.env`, `docker-compose.yml`, `.env.example`

- [ ] Ajouter `BGG_API_TOKEN: str({ default: "" })` dans `backend/src/config/env.ts`
- [ ] Ajouter `BGG_API_TOKEN=<token>` dans `.env` local
- [ ] Ajouter `BGG_API_TOKEN=${BGG_API_TOKEN}` dans la section `environment` du
  service `backend` de `docker-compose.yml`, `docker-compose.prod.yml`,
  `docker-compose.preprod.yml`
- [ ] Ajouter `BGG_API_TOKEN=` (vide) dans `.env.example`
- [ ] Ajouter `BGG_API_TOKEN` comme secret GitHub Actions
  (`Settings > Secrets > Actions > New repository secret`)
- [ ] Passer le secret dans le job `test-e2e` du workflow (optionnel, pour E2E BGG)

---

## Etape 2 — Refactoring bgg.ts

**Fichier** : `backend/src/services/bgg.ts`

### 2a. Auth header

- [ ] Lire `env.BGG_API_TOKEN`
- [ ] Ajouter `Authorization: Bearer <token>` dans les headers de fetch si token present

### 2b. Gestion 202 Processing

- [ ] Detecter `response.status === 202`
- [ ] Implementer backoff : attente 2s, 4s, 8s entre les tentatives
- [ ] Max 3 retries sur 202, puis retourner `null`/`[]` avec warning

### 2c. Gestion 429 Rate limit

- [ ] Detecter `response.status === 429`
- [ ] Lire `Retry-After` header si present (en secondes)
- [ ] Attendre ce delai (ou 10s par defaut), retry une seule fois
- [ ] Si deuxieme 429 : retourner `null`/`[]` avec warning

### 2d. Gestion 401

- [ ] Detecter `response.status === 401`
- [ ] Logger une erreur explicite : "BGG API returned 401 — check BGG_API_TOKEN"
- [ ] Ne pas retenter, retourner `null`/`[]`

### 2e. Sanitisation description

- [ ] Installer `he` : `npm install he && npm install --save-dev @types/he`
- [ ] Dans `fetchBGGThing` : decoder les entites HTML de `description` via `he.decode()`
- [ ] Supprimer les balises HTML residuelles avec une regex simple :
  `str.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()`

### 2f. Normalisation imageUrl

- [ ] Si `imageUrl` commence par `//` : prefixer `https:`
- [ ] Si vide ou invalide : retourner `undefined`

### 2g. Warning au demarrage

- [ ] Dans `backend/src/server.ts` : si `env.BGG_API_TOKEN` est vide,
  `logger.warn("BGG_API_TOKEN not configured — BGG search disabled")`

---

## Etape 3 — Tests unitaires bgg.ts

**Fichier** : `backend/src/__tests__/unit/bgg.test.ts`

Utiliser `vi.stubGlobal('fetch', ...)` pour mocker les requetes HTTP.

- [ ] Token present → header `Authorization: Bearer <token>` envoye
- [ ] Token absent → pas d'header Authorization
- [ ] 200 OK search → parse correct (format array de noms)
- [ ] 200 OK search → parse correct (format objet unique)
- [ ] 200 OK thing → tous les champs mappes correctement
- [ ] 200 OK thing → description sanitisee (HTML decode + balises supprimees)
- [ ] 200 OK thing → imageUrl normalisee (`//cdn...` → `https://cdn...`)
- [ ] 202 → retry jusqu'a succes (mock : 202, 202, 200)
- [ ] 202 x3 → retourne null/[] apres 3 tentatives
- [ ] 429 avec Retry-After → attend et retente
- [ ] 429 x2 → retourne null/[] sans boucle infinie
- [ ] 401 → retourne null/[], log erreur, pas de retry
- [ ] Network error → retourne null/[] sans crash
- [ ] Timeout → retourne null/[] sans crash
- [ ] BGG retourne 0 resultats → retourne []

---

## Etape 4 — Test live manuel

**Fichier** : `backend/src/__tests__/manual/bgg-live.test.ts`

- [ ] Creer le fichier (skippe en CI via config vitest exclude)
- [ ] Mettre a jour `vitest.config.ts` pour exclure `**/__tests__/manual/**`
- [ ] Tests :
  - `searchBGG("Catan")` → au moins 1 resultat avec bggId et name
  - `fetchBGGThing("13")` → retourne les details complets de Catan (bggId=13)
  - Verifier description sans balises HTML
  - Verifier imageUrl commence par `https://`
- [ ] **Lancer manuellement** et verifier : `BGG_API_TOKEN=<token> npx vitest run src/__tests__/manual`

---

## Etape 5 — Tests d'integration (verification non-regression)

**Fichier** : `backend/src/__tests__/integration/boardGame.test.ts`

- [ ] Verifier que tous les tests existants passent encore (ils mockent `bggService` — pas de changement attendu)
- [ ] Ajouter : si `searchBGG` leve une exception, `searchBoardGames` retourne quand meme les resultats locaux

---

## Etape 6 — Test E2E Playwright

**Fichier** : `e2e/boardgames.spec.ts`

Prerequis : `BGG_API_TOKEN` disponible dans l'environnement E2E.

- [ ] Creer le fichier
- [ ] Scenario : admin cherche "Catan" → voit des resultats BGG
- [ ] Scenario : clic sur un resultat BGG → l'ajoute a l'event
- [ ] Scenario : le jeu apparait dans la liste des jeux de l'event
- [ ] Scenario : si `BGG_API_TOKEN` absent → recherche retourne uniquement locaux, pas d'erreur visible

---

## Etape 7 — Mise a jour CI/CD

**Fichier** : `.github/workflows/deploy.yml`

- [ ] Ajouter `BGG_API_TOKEN: ${{ secrets.BGG_API_TOKEN }}` dans le step
  "Start backend" du job `test-e2e`
- [ ] Ajouter `BGG_API_TOKEN` dans les env du job `test-backend` si necessaire
  (non requis, les tests unitaires/integration mockent tout)

---

## Etape 8 — Documentation

- [ ] Mettre a jour `NEXT_STEPS.md` : Phase 14 complete
- [ ] Mettre a jour `DB_MODELS.md` si schema change (normalement non)
- [ ] Mettre a jour `API_MAP.md` si comportement change (normalement non)
- [ ] Ajouter `BGG_API_TOKEN` dans la section "Variables d'environnement" du README
  quand il sera cree (Phase 13)

---

## Ordre recommande

```
Prerequis (obtenir token BGG)
  └─ Etape 1 (env)
      └─ Etape 2 (bgg.ts refactoring)
          ├─ Etape 3 (tests unitaires)  ← en parallele avec etape 2
          └─ Etape 4 (test live manuel)
              └─ Etape 5 (non-regression integration)
                  └─ Etape 6 (E2E)
                      └─ Etape 7 (CI)
                          └─ Etape 8 (docs)
```

**Estimation** : 1 journee de code (hors attente token BGG).
Le token est le seul vrai bloquant — si approuve rapidement, tout peut etre fait
en une session.

---

## Risques

| Risque | Probabilite | Impact | Mitigation |
|---|---|---|---|
| Token BGG refuse / delai long | Faible | Moyen | Mode manuel reste fonctionnel |
| BGG change encore l'API | Faible | Fort | Architecture isolee dans bgg.ts facilite les changements |
| Rate limiting agressif en prod | Moyen | Faible | Cache local (deja en place) absorbe la majorite |
| Token expire sans alerte | Moyen | Faible | Degraded mode + log 401 explicite |
