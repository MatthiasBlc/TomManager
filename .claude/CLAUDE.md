# TomManager

Application web full-stack.

## Stack

React 18 + TS + Vite + TailwindCSS + DaisyUI | Node.js + Express + TS | PostgreSQL + Prisma | Docker + GitHub Actions + Portainer

## Conventions

- **Langue**: Code 100% anglais (variables, fonctions, modeles). Commentaires francais OK
- **Accents**: ASCII only partout (code, commentaires, docs) SAUF le texte visible par l'utilisateur dans le front (labels UI, messages, textes affiches a l'ecran) qui doit utiliser les accents francais corrects
- **Soft delete**: `deletedAt` sur entites principales (User)
- **IDs**: UUID v4 partout
- **Roles**: USER | ADMIN (dans le meme systeme User)
- **Sessions**: express-session avec Prisma session store (`connect.sid` 1h)

## Commandes essentielles

```bash
npm run docker:up:build        # Demarrer dev
npm run docker:logs            # Logs
npm test                       # Tous les tests (backend + frontend)
npm run test:backend           # Backend seul
npm run test:frontend          # Frontend seul
npx prisma migrate dev         # Migrations (dans container)
npx prisma studio              # DB GUI :5555
```

## Tests E2E (Playwright)

**Architecture** : Playwright tourne EN LOCAL (pas dans Docker). Le stack Docker doit etre demarré avant.

```bash
# Prérequis unique (a faire une seule fois)
npx playwright install chromium

# Lancer les tests e2e
npx playwright test --project=chromium   # Chromium seul (recommande)
npm run test:e2e                         # Tous les projets

# Debug
npx playwright test --grep "nom du test"  # Un seul test
```

**Pas de variables d'environnement nécessaires localement.** L'app est sur `http://localhost:3000` par défaut (voir `playwright.config.ts`).

**CI** : Le CI ne passe pas par Docker — il lance le backend/frontend directement avec Node.js sur le runner GitHub Actions, et installe Chromium via `npx playwright install chromium --with-deps`. Ne pas chercher de docker-compose pour les e2e en CI.

## Git

- **Main**: master
- **Branche de dev**: Developement
- **Commits**: Ne JAMAIS ajouter de Co-Authored-By pour Claude

### Workflow

1. Creer une branche `feature/*` depuis `Developement`
2. Developper et committer sur la feature branch
3. Merger la feature branch dans `Developement`
4. Push `Developement` sur GitHub
5. PR `Developement` -> `master` sur GitHub (jamais de push direct sur master)

## Phase actuelle

Setup initial. Voir `.claude/context/PROGRESS.md`.

## Regle: maintenir `.claude/` a jour

Apres chaque modification (nouveau fichier, endpoint, migration, test, phase, branche), mettre a jour :

- `.claude/context/` (PROGRESS, TESTS, API_MAP, DB_MODELS, FILE_MAP selon pertinence)

Si une tache est en cours et que les tokens arrivent a leur limite, generer `.claude/context/RESUME.md` avec: tache en cours, etapes faites, etapes restantes, fichiers modifies, et tout contexte necessaire pour reprendre sans perte.

### PROGRESS.md : garder le fichier compact

- Juste un lien vers la phase en cours
- Pas de duplication

## Organisation docs/

```
docs/
  features/                         # Specs par feature
    nom-feature/
      SPEC_NOM_FEATURE.md
      ROADMAP.md
  changelogs/                       # Changelogs utilisateur (un fichier par merge vers master)
    YYYY-MM-DD_nom-branche.md
```

Chaque nouvelle feature a son dossier dans `docs/features/` avec au minimum une spec et une roadmap.

## Regle: changelog utilisateur

Lorsque l'utilisateur demande un "changelog user" ou "changelog utilisateur" :

1. Identifier le dernier fichier dans `docs/changelogs/` (tri par nom = tri chronologique)
2. Lister les commits de la branche courante depuis ce dernier changelog (ou depuis `master` si aucun)
3. Rediger un fichier `docs/changelogs/YYYY-MM-DD_nom-branche.md` en respectant le format ci-dessous
4. Afficher le contenu dans la reponse pour validation

### Format exact du changelog

Chaque section est separee par `---`. Patron a suivre :

```
  :emoji-shortcode: **Titre de la feature**

  Description en 2-3 phrases orientees utilisateur, ton simple et positif.

  ---
  :wrench: Corrections

- Correction 1
- Correction 2
```

Regles :

- Emoji en shortcode (`:book:`, `:tools:`, `:wrench:`, `:twisted_rightwards_arrows:`, etc.)
- Titre en **gras** apres l'emoji
- Separateur `---` entre chaque section
- Corrections groupees en fin sous `:wrench: Corrections` en liste a puces
- Pas de jargon technique, pas d'accents (ASCII only)

## Contexte approfondi (lire selon le besoin)

| Besoin                              | Fichier                        |
| ----------------------------------- | ------------------------------ |
| Avancement & phase en cours         | `.claude/context/PROGRESS.md`  |
| Tests: commandes, inventaire, infra | `.claude/context/TESTS.md`     |
| Endpoints API complets              | `.claude/context/API_MAP.md`   |
| Schema DB & modeles Prisma          | `.claude/context/DB_MODELS.md` |
| Arborescence fichiers source        | `.claude/context/FILE_MAP.md`  |

## Recommandations modele & effort

**Lorsqu'un plan est prepare**, inclure une recommandation **modele + effort** pour chaque feature/tâche selon cette grille :

| Complexité   | Modele     | Effort   | Exemples                                                                    |
| ------------ | ---------- | -------- | --------------------------------------------------------------------------- |
| Trivial      | Haiku 4.5  | 15-30min | Fixes typos, ajouter 1 champ, simple component                              |
| Simple       | Haiku 4.5  | 30min-1h | Tests unitaires, composants presentationnels, CSS adjustments               |
| Moderate     | Sonnet 4.6 | 1-3h     | Features avec logique, tests modales, API endpoints simples                 |
| Complex      | Opus 4.6   | 3-8h     | Arch majeure, refacto, features multi-domaines, debugging problemes subtils |
| Very complex | Opus 4.6   | 8h+      | Rework entier du systeme, optimisations perf, migrations donnees            |

**Objectif** : optimiser cout (Haiku est ~3x moins cher qu'Opus) tout en restant efficace.
Tu peux toujours escalader a Opus mid-course si la tache devient plus complexe que prevue.
