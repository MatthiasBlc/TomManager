# TomManager

Application web full-stack.

## Stack

React 18 + TS + Vite + TailwindCSS + DaisyUI | Node.js + Express + TS | PostgreSQL + Prisma | Docker + GitHub Actions + Portainer

## Conventions

- **Langue**: Code 100% anglais (variables, fonctions, modeles). Commentaires francais OK
- **Accents**: Aucun dans le code/docs (ASCII only)
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

## Git

- **Main**: master
- **Branche courante**: master
- **Commits**: Ne JAMAIS ajouter de Co-Authored-By pour Claude

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
```

Chaque nouvelle feature a son dossier dans `docs/features/` avec au minimum une spec et une roadmap.

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

| Complexité | Modele | Effort | Exemples |
|---|---|---|---|
| Trivial | Haiku 4.5 | 15-30min | Fixes typos, ajouter 1 champ, simple component |
| Simple | Haiku 4.5 | 30min-1h | Tests unitaires, composants presentationnels, CSS adjustments |
| Moderate | Sonnet 4.6 | 1-3h | Features avec logique, tests modales, API endpoints simples |
| Complex | Opus 4.6 | 3-8h | Arch majeure, refacto, features multi-domaines, debugging problemes subtils |
| Very complex | Opus 4.6 | 8h+ | Rework entier du systeme, optimisations perf, migrations donnees |

**Objectif** : optimiser cout (Haiku est ~3x moins cher qu'Opus) tout en restant efficace.
Tu peux toujours escalader a Opus mid-course si la tache devient plus complexe que prevue.
