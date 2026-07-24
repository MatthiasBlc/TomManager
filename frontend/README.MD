# Frontend

Interface web du projet TomManager : React 18 + TypeScript + Vite + TailwindCSS + DaisyUI.

## Stack

- React 18 + TypeScript
- Vite (build/dev server)
- TailwindCSS + DaisyUI (UI)
- React Router
- React Hook Form
- Socket.io-client (temps reel)
- FullCalendar (planning collaboratif)
- Vitest + Testing Library (tests)

## Structure

```
src/
├── components/    # Composants reutilisables
├── pages/         # Pages routees
├── hooks/         # Hooks React custom
├── contexts/      # Contexts React (auth, socket, etc.)
├── routes/        # Configuration du routing
├── config/        # Configuration (URL backend, etc.)
├── styles/        # Styles globaux (Tailwind)
├── types/         # Types partages
├── utils/         # Fonctions utilitaires
├── test/          # Setup et helpers de test
└── __tests__/     # Tests unitaires (composants, hooks)
```

## Commandes

Ce package tourne normalement dans Docker (voir le README racine). En local, dans `frontend/` :

```bash
npm run dev          # Serveur dev Vite (port 3000)
npm run build         # Typecheck (tsc) + build de production
npm run preview       # Previsualiser le build (port 8080)

npm run lint          # ESLint (0 warning tolere)

npm test              # Tests unitaires (vitest)
npm run test:watch    # Tests en mode watch
npm run test:coverage # Couverture de tests
```

## Variables d'environnement

Voir le README racine (section "Variables d'environnement"). Cote frontend : `VITE_BACKEND_URL` (URL de l'API vue depuis le navigateur) et `VITE_SENTRY_DSN` (optionnel, tracking d'erreurs).

## Tests

Tests unitaires (Vitest + Testing Library) sur les composants et hooks, dans `src/__tests__/`. Les tests E2E (Playwright) qui couvrent les flux complets frontend + backend se trouvent dans `e2e/` a la racine du repo (voir le README racine).
