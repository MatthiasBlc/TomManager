# RESUME - Prochaine session

## Tache a faire

Etendre la couverture de tests frontend pour atteindre 50% sur TOUS les fichiers source
(actuellement le coverage est limite au perimetre des fichiers deja testes via `include` dans vitest.config.ts).

## Contexte

Le CI `test-frontend` utilisait un seuil de 50% statements/branches mais la couverture reelle
etait ~23% car les composants boardgames/planning/events ont 0% de tests.

Solution temporaire appliquee : ajout d'un `include` dans `frontend/vitest.config.ts` pour
restreindre le perimetre de coverage aux fichiers deja testes. Les seuils restent a 50%.

Le `include` actuel couvre :

- `src/App.tsx`
- `src/routes/**`
- `src/components/common/**`
- `src/components/layout/**`
- `src/components/notifications/**`
- `src/pages/HomePage.tsx`
- `src/pages/LoginPage.tsx`

## Fichiers sans tests (a couvrir)

### Composants (0% coverage)

- `src/components/boardgames/` : AddGameModal, BoardGameCard, BoardGameList, BoardGameSearchInput, BoardGameTab, BoardGameForm
- `src/components/events/` : CreateEventModal, EditEventModal, ParticipantList
- `src/components/planning/` : CalendarView, CreateTableModal, EditTableModal, PlanningTab, TableCard, TableDetailModal, TagInput, TimelineView, EventBlock

### Pages (0-15% coverage)

- `src/pages/EventDetailPage.tsx`
- `src/pages/EventListPage.tsx`
- `src/pages/NotFoundPage.tsx`
- `src/pages/PlanningPage.tsx`
- `src/pages/ProfilePage.tsx`
- `src/pages/TableDetailPage.tsx`

### Autres

- `src/config/api.ts` (50% mais non inclus dans perimetre)
- `src/contexts/AuthContext.tsx` (57%)
- `src/hooks/` : useEventSocket, useNotifications, useSocket (0-8%)

## Objectif

Supprimer le `include` de `frontend/vitest.config.ts` (ou l'etendre a `src/**`) et ajouter
suffisamment de tests unitaires pour atteindre 50% globalement.

Approche recommandee :

1. Commencer par les composants les plus simples a tester (TableCard, BoardGameCard, ParticipantList)
2. Puis les pages (mocking des hooks API)
3. Enfin les hooks (mocking axios/socket)

## Fichier a modifier en fin de session

- `frontend/vitest.config.ts` : supprimer le bloc `include` une fois 50% atteint globalement
