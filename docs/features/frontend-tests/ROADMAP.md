# Roadmap : Tests Frontend

## Regles obligatoires entre chaque phase

Avant de passer a la phase suivante :

- [ ] `npm run test:frontend` : tous les tests passent (0 failures)
- [ ] `npm run lint` : 0 errors, 0 warnings
- [ ] Commit intermediaire avec message clair (ex: `test: phase 1 - hooks`)

---

## Phase 1 — Hooks utilitaires

> Logique pure sans dependances externes. Les plus simples a tester.

- [ ] `useIsMobile` — retourne `true`/`false` selon `window.innerWidth`
- [ ] `useOnlineStatus` — ecoute les evenements `online`/`offline`

**Checklist de validation :**
- [ ] Tests passent
- [ ] Lint parfait
- [ ] Commit `test: phase 1 - utility hooks`

---

## Phase 2 — Composants presentationnels

> Composants sans etat propre ni appels API. Rendu pur base sur les props.

- [ ] `EmptyState` — rendu du message et de l'icone
- [ ] `FAB` — rendu du bouton, click handler
- [ ] `Skeleton` — rendu des variantes (card, list, etc.)
- [ ] `TableCard` — rendu des donnees de table, badges de tags
- [ ] `NotificationItem` — rendu du contenu, etat lu/non-lu
- [ ] `CustomEventBlock` — rendu de l'evenement dans le calendrier

**Checklist de validation :**
- [ ] Tests passent
- [ ] Lint parfait
- [ ] Commit `test: phase 2 - presentational components`

---

## Phase 3 — Composants avec logique conditionnelle

> Composants qui affichent ou masquent des elements selon les props/etat.

- [ ] `PrivateRoute` — redirige si non authentifie, affiche le contenu sinon
- [ ] `ErrorBoundary` — affiche le fallback quand une erreur est lancee
- [ ] `ConnectionStatus` — affiche le bon etat selon `isOnline`
- [ ] `BoardGameSearchInput` — filtre la liste, affiche les resultats

**Checklist de validation :**
- [ ] Tests passent
- [ ] Lint parfait
- [ ] Commit `test: phase 3 - conditional logic components`

---

## Phase 4 — Composants avec contexte Auth

> Composants qui consomment `useAuth`. Necessitent un wrapper `AuthProvider` mocke.

- [ ] `Navbar` — affiche les liens selon le role (USER / ADMIN)
- [ ] `BottomTabBar` — navigation mobile, onglet actif
- [ ] `MobileHeader` — titre de page, bouton retour conditionnel
- [ ] `AppLayout` — structure generale avec auth

**Pattern a suivre :**

```tsx
const renderWithAuth = (ui: ReactNode, user = mockUser) =>
  render(<AuthContext.Provider value={{ user, loading: false, ...mockFns }}>{ui}</AuthContext.Provider>);
```

**Checklist de validation :**
- [ ] Tests passent
- [ ] Lint parfait
- [ ] Commit `test: phase 4 - auth-aware components`

---

## Phase 5 — Composants de liste et d'affichage de donnees

> Composants qui recoivent des tableaux de donnees et les rendent.

- [ ] `BoardGameList` — liste vide, liste avec items, pagination
- [ ] `ParticipantList` — affichage des participants, bouton rejoindre/quitter
- [ ] `TimelineView` — rendu des evenements sur la timeline
- [ ] `NotificationBell` — compteur de non-lus, ouverture du panneau

**Checklist de validation :**
- [ ] Tests passent
- [ ] Lint parfait
- [ ] Commit `test: phase 5 - data display components`

---

## Phase 6 — Formulaires

> Composants avec `react-hook-form`. Tester la validation et la soumission.

- [ ] `BoardGameForm` — validation des champs requis, soumission
- [ ] `TagInput` — ajout/suppression de tags, validation
- [ ] `LoginPage` — validation email/password, affichage des erreurs

**Pattern a suivre :**

```tsx
it("affiche une erreur si le champ est vide", async () => {
  render(<BoardGameForm onSubmit={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /valider/i }));
  expect(screen.getByText(/champ requis/i)).toBeInTheDocument();
});
```

**Checklist de validation :**
- [ ] Tests passent
- [ ] Lint parfait
- [ ] Commit `test: phase 6 - forms`

---

## Phase 7 — Modales complexes (optionnel)

> Modales avec plusieurs etapes ou interactions. A prioriser si elles portent de la logique metier.

- [ ] `CreateTableModal` — flux complet de creation, champs conditionnels (type JDR)
- [ ] `AddBoardGameModal` — recherche BGG, selection, ajout
- [ ] `TableDetailModal` — affichage des details, actions selon le role

**Checklist de validation :**
- [ ] Tests passent
- [ ] Lint parfait
- [ ] Commit `test: phase 7 - complex modals`

---

## Phase 8 — Pages

> Pages completes avec Router et appels API. Necessitent `MemoryRouter` et des mocks axios.

**Setup commun a creer une fois (`src/test/renderWithRouter.tsx`) :**

```tsx
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";

export const renderWithRouter = (ui: ReactNode, { route = "/" } = {}) =>
  render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
```

**Mock axios a placer dans chaque test file :**

```tsx
vi.mock("../config/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
```

- [ ] `NotFoundPage` — rendu statique, lien retour accueil
- [ ] `HomePage` — rendu selon role (USER / ADMIN)
- [ ] `LoginPage` — soumission du formulaire, redirection apres login
- [ ] `ProfilePage` — affichage des donnees utilisateur, deconnexion Discord
- [ ] `EventListPage` — liste des evenements, etat vide
- [ ] `EventDetailPage` — affichage du detail, actions selon participation
- [ ] `TableDetailPage` — affichage de la table, ajout de jeu, gestion participants

**Checklist de validation :**
- [ ] Tests passent
- [ ] Lint parfait
- [ ] Commit `test: phase 8 - pages`

---

## Objectifs de coverage cibles

| Phase complete | Coverage vise |
|---|---|
| Phase 1-2 | > 20% |
| Phase 1-4 | > 40% |
| Phase 1-6 | > 60% |
| Phase 1-7 | > 75% |
| Phase 1-8 | > 85% |
