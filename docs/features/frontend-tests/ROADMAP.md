# Roadmap : Tests Frontend

## Regles obligatoires entre chaque phase

Avant de passer a la phase suivante :

- [ ] `npm run test:frontend` : tous les tests passent (0 failures)
- [ ] `npm run lint` : 0 errors, 0 warnings
- [ ] Commit intermediaire avec message clair (ex: `test: phase 1 - hooks`)

---

## Phase 1 — Hooks utilitaires

> Logique pure sans dependances externes. Les plus simples a tester.

- [x] `useIsMobile` — retourne `true`/`false` selon `window.innerWidth`
- [x] `useOnlineStatus` — ecoute les evenements `online`/`offline`

**Checklist de validation :**

- [x] Tests passent
- [x] Lint parfait
- [x] Commit `test: phase 1 - utility hooks`

---

## Phase 2 — Composants presentationnels

> Composants sans etat propre ni appels API. Rendu pur base sur les props.

- [x] `EmptyState` — rendu du message et de l'icone
- [x] `FAB` — rendu du bouton, click handler
- [x] `Skeleton` — rendu des variantes (card, list, etc.)
- [x] `TableCard` — rendu des donnees de table, badges de tags
- [x] `NotificationItem` — rendu du contenu, etat lu/non-lu
- [ ] ~~`CustomEventBlock`~~ — composant inexistant dans la codebase, ignore

**Checklist de validation :**

- [x] Tests passent
- [x] Lint parfait
- [x] Commit `test: phase 2 - presentational components`

---

## Phase 3 — Composants avec logique conditionnelle

> Composants qui affichent ou masquent des elements selon les props/etat.

- [x] `PrivateRoute` — redirige si non authentifie, affiche le contenu sinon
- [x] `ErrorBoundary` — affiche le fallback quand une erreur est lancee
- [x] `ConnectionStatus` — affiche le bon etat selon le socket
- [x] `BoardGameSearchInput` — filtre la liste, affiche les resultats

**Checklist de validation :**

- [x] Tests passent
- [x] Lint parfait
- [x] Commit `test: phase 3 - conditional logic components`

---

## Phase 4 — Composants avec contexte Auth

> Composants qui consomment `useAuth`. Necessitent un wrapper `AuthProvider` mocke.

- [x] `Navbar` — desktop/mobile, login/logout, liens visibles selon auth
- [x] `BottomTabBar` — tabs Events/Planning/Games selon route, logout button
- [x] `MobileHeader` — logo TM, bell + status visibles si auth
- [x] `AppLayout` — padding mobile/desktop selon auth

**Pattern a suivre :**

```tsx
const renderWithAuth = (ui: ReactNode, user = mockUser) =>
  render(
    <AuthContext.Provider value={{ user, loading: false, ...mockFns }}>{ui}</AuthContext.Provider>
  );
```

**Checklist de validation :**

- [x] Tests passent
- [x] Lint parfait
- [x] Commit `test: phase 4 - auth-aware components`

---

## Phase 5 — Composants de liste et d'affichage de donnees

> Composants qui recoivent des tableaux de donnees et les rendent.

- [x] `BoardGameList` — liste vide, liste avec items, regroupement par jeu
- [x] `ParticipantList` — affichage des participants, remove/leave selon role
- [x] `TimelineView` — empty state, rendu cartes, regroupement par date
- [x] `NotificationBell` — compteur de non-lus, dropdown desktop, sheet mobile

**Checklist de validation :**

- [x] Tests passent
- [x] Lint parfait
- [x] Commit `test: phase 5 - data display components`

---

## Phase 6 — Formulaires

> Composants avec `react-hook-form`. Tester la validation et la soumission.

- [x] `ManualBoardGameForm` — validation champs, soumission, cancel (composant existant : ManualBoardGameForm, pas BoardGameForm)
- [x] `TagInput` — ajout (Enter/comma), suppression, suggestions API, dedupe, backspace
- [x] `LoginPage` — submit, redirect post-login, erreur, Discord OAuth

**Pattern a suivre :**

```tsx
it("affiche une erreur si le champ est vide", async () => {
  render(<BoardGameForm onSubmit={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /valider/i }));
  expect(screen.getByText(/champ requis/i)).toBeInTheDocument();
});
```

**Checklist de validation :**

- [x] Tests passent
- [x] Lint parfait
- [x] Commit `test: phase 6 - forms`

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
| -------------- | ------------- |
| Phase 1-2      | > 20%         |
| Phase 1-4      | > 40%         |
| Phase 1-6      | > 60%         |
| Phase 1-7      | > 75%         |
| Phase 1-8      | > 85%         |
