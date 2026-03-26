# Roadmap : Phase 7 - UI Mobile-First & Polish

Spec de reference : [SPEC_UI_MOBILE_FIRST.md](./SPEC_UI_MOBILE_FIRST.md)

---

## Session 1 : Fondations mobile - Navigation & Layout

**Objectif** : Poser la navigation mobile (bottom bar + header compact) et le composant MobileSheet.

- [ ] Composant `BottomTabBar` : barre fixe en bas, icones + labels, onglet actif, safe area iOS
- [ ] Composant `MobileHeader` : header fixe top, logo compact, NotificationBell, ConnectionStatus
- [ ] Hook `useIsMobile()` : basé sur `matchMedia('(max-width: 767px)')`, reactif au resize
- [ ] Refactorer `Navbar.tsx` : afficher MobileHeader + BottomTabBar sur mobile, navbar classique sur desktop
- [ ] Ajuster `App.tsx` / layout global : padding bottom pour bottom bar sur mobile
- [ ] Composant `MobileSheet` : bottom sheet (monte du bas, swipe-down close, backdrop, max-h-90vh, scroll interne)
- [ ] Tests : BottomTabBar (render, onglet actif), MobileSheet (open/close)

**Validation** : Navigation fonctionnelle sur mobile et desktop, tests passent.

---

## Session 2 : Auth pages + HomePage mobile-first

**Objectif** : Pages auth parfaites sur mobile.

- [ ] `HomePage` : texte responsive (`text-2xl` -> `md:text-4xl`), CTA `btn-block` sur mobile
- [ ] `LoginPage` : supprimer `w-96`, card `w-full px-4` -> `sm:max-w-sm sm:mx-auto`, inputs `btn-block`
- [ ] `SignupPage` : idem LoginPage
- [ ] `InvitationLandingPage` : idem LoginPage
- [ ] Inputs : `inputmode="email"` sur les champs email, espacement `space-y-4`
- [ ] Tests : rendu mobile des pages auth (pas de debordement horizontal)

**Validation** : Pages auth responsive, aucun scroll horizontal sur 320px.

---

## Session 3 : EventListPage + EventDetailPage mobile-first

**Objectif** : Liste d'events et detail parfaits sur mobile.

- [ ] `EventListPage` : grille 1 colonne mobile, 2/3 colonnes desktop. FAB "Creer Event" sur mobile
- [ ] Composant `FAB` (Floating Action Button) : rond, fixe en bas a droite, au-dessus de la bottom bar
- [ ] `EventDetailPage` : tabs scrollables horizontalement sur mobile (`overflow-x-auto scroll-snap-x`)
- [ ] `CreateEventModal` + `EditEventModal` : utiliser MobileSheet sur mobile, modal sur desktop
- [ ] `ParticipantList` : cartes empilees sur mobile, table sur desktop
- [ ] `InvitationManager` : form pleine largeur + cartes sur mobile, table sur desktop
- [ ] Tests : EventListPage en mobile (1 colonne, FAB visible), ParticipantList mobile (pas de table)

**Validation** : Events navigables et lisibles sur 320px.

---

## Session 4 : PlanningPage + TableDetailPage mobile-first

**Objectif** : Planning et detail table parfaits sur mobile.

- [ ] `PlanningPage` : TimelineView 1 colonne mobile, FAB "Creer Table", headers jour sticky
- [ ] `TableCard` : padding et tailles de texte responsive, `active:scale-95` au tap
- [ ] `TableDetailPage` : participants en card list (pas table) sur mobile, boutons action `sticky bottom btn-block`
- [ ] `CreateTableModal` + `EditTableModal` : MobileSheet sur mobile, grille datetime `grid-cols-1` -> `sm:grid-cols-2`
- [ ] `TagInput` : taille cibles touch >= 44px
- [ ] Tests : TableDetailPage mobile (pas de table HTML), boutons sticky

**Validation** : Planning utilisable au pouce sur mobile.

---

## Session 5 : Board Games + Notifications mobile-first

**Objectif** : Jeux et notifications parfaits sur mobile.

- [ ] `BoardGameTab` : header responsive, bouton "Ajouter" adapte
- [ ] `BoardGameList` + `BoardGameCard` : cartes avec taille touch suffisante, bouton supprimer agrandi
- [ ] `AddBoardGameModal` : MobileSheet sur mobile
- [ ] `BoardGameSearchInput` : dropdown adapte mobile (max-h responsive, position safe)
- [ ] `NotificationBell` : dropdown -> bottom sheet sur mobile
- [ ] `NotificationItem` : zones cliquables >= 44px, swipe-to-delete envisageable (optionnel)
- [ ] Tests : BoardGameCard touch targets, NotificationBell mobile

**Validation** : Jeux et notifications utilisables sur mobile.

---

## Session 6 : Skeletons, empty states, feedback visuel

**Objectif** : Feedback utilisateur complet (loading, vide, erreurs).

- [ ] Composant `Skeleton` reutilisable (card skeleton, list skeleton, text skeleton)
- [ ] Skeletons dans : EventListPage, PlanningPage, TableDetailPage, BoardGameList, NotificationBell dropdown
- [ ] Composant `EmptyState` reutilisable (icone + texte + CTA optionnel)
- [ ] Empty states dans : EventListPage, PlanningPage, BoardGameList, ParticipantList, NotificationBell
- [ ] `active:scale-95` sur tous les boutons et cartes cliquables
- [ ] Transitions d'apparition (`animate-fade-in`) sur les contenus charges
- [ ] Tests : skeletons affiches pendant loading, empty states affiches quand liste vide

**Validation** : Aucune page ne reste "blanche" pendant le chargement.

---

## Session 7 : Coherence visuelle, accessibilite, theme

**Objectif** : Audit global d'uniformite, accessibilite de base.

- [ ] Audit couleurs : remplacer toute couleur hardcodee par variables DaisyUI
- [ ] Audit arrondis : uniformiser (choix projet : `rounded-lg` pour les cartes, `rounded-xl` pour les modals/sheets)
- [ ] Audit ombres : `shadow-sm` cartes, `shadow-lg` modals
- [ ] `aria-label` sur tous les boutons icone-only
- [ ] `role="dialog"` + `aria-modal` sur MobileSheet et modals
- [ ] Focus trap dans MobileSheet
- [ ] Labels `htmlFor` sur tous les inputs
- [ ] Integration `vitest-axe` : test axe sur pages principales (0 erreur critique)
- [ ] Tests : accessibilite axe-core sur EventListPage, PlanningPage, TableDetailPage

**Validation** : Zero violation axe "critical" ou "serious".

---

## Session 8 : Backend polish + PWA + docs

**Objectif** : Ajustements backend, PWA basique, documentation finale.

- [ ] Backend : standardiser format erreurs (`{ error, details? }`)
- [ ] Backend : rate limiting sur `/api/auth/login` et `/api/auth/signup`
- [ ] Backend : verifier que tous les endpoints de liste supportent `?limit=`
- [ ] `manifest.json` : nom, icones, theme-color, `display: standalone`
- [ ] Meta tags : viewport, theme-color, apple-mobile-web-app-capable
- [ ] Hook `useOnlineStatus` : banner "Hors connexion" quand offline
- [ ] Mise a jour `.claude/context/` : PROGRESS, FILE_MAP, TESTS
- [ ] Tests backend : rate limiting, format erreurs

**Validation** : `npm test` passe (backend + frontend), PWA installable sur mobile.
