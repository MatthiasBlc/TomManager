# Roadmap : Phase 7 - UI Mobile-First & Polish

Spec de reference : [SPEC_UI_MOBILE_FIRST.md](./SPEC_UI_MOBILE_FIRST.md)

---

## Session 1 : Fondations mobile - Navigation & Layout

**Objectif** : Poser la navigation mobile (bottom bar + header compact) et le composant MobileSheet.

- [x] Composant `BottomTabBar` : barre fixe en bas, icones + labels, onglet actif, safe area iOS
- [x] Composant `MobileHeader` : header fixe top, logo compact, NotificationBell, ConnectionStatus
- [x] Hook `useIsMobile()` : basé sur `matchMedia('(max-width: 767px)')`, reactif au resize
- [x] Refactorer `Navbar.tsx` : afficher MobileHeader + BottomTabBar sur mobile, navbar classique sur desktop
- [x] Ajuster `App.tsx` / layout global : padding bottom pour bottom bar sur mobile
- [x] Composant `MobileSheet` : bottom sheet (monte du bas, swipe-down close, backdrop, max-h-90vh, scroll interne)
- [x] Tests : BottomTabBar (render, onglet actif), MobileSheet (open/close)

**Validation** : Navigation fonctionnelle sur mobile et desktop, tests passent.

---

## Session 2 : Auth pages + HomePage mobile-first

**Objectif** : Pages auth parfaites sur mobile.

- [x] `HomePage` : texte responsive (`text-2xl` -> `md:text-4xl`), CTA `btn-block` sur mobile
- [x] `LoginPage` : supprimer `w-96`, card `w-full px-4` -> `sm:max-w-sm sm:mx-auto`, inputs `btn-block`
- [x] `SignupPage` : idem LoginPage
- [x] `InvitationLandingPage` : idem LoginPage
- [x] Inputs : `inputmode="email"` sur les champs email, espacement `space-y-4`
- [x] Tests : rendu mobile des pages auth (pas de debordement horizontal)

**Validation** : Pages auth responsive, aucun scroll horizontal sur 320px.

---

## Session 3 : EventListPage + EventDetailPage mobile-first

**Objectif** : Liste d'events et detail parfaits sur mobile.

- [x] `EventListPage` : grille 1 colonne mobile, 2/3 colonnes desktop. FAB "Creer Event" sur mobile
- [x] Composant `FAB` (Floating Action Button) : rond, fixe en bas a droite, au-dessus de la bottom bar
- [x] `EventDetailPage` : tabs scrollables horizontalement sur mobile (`overflow-x-auto scroll-snap-x`)
- [x] `CreateEventModal` + `EditEventModal` : utiliser MobileSheet sur mobile, modal sur desktop
- [x] `ParticipantList` : cartes empilees sur mobile, table sur desktop
- [x] `InvitationManager` : form pleine largeur + cartes sur mobile, table sur desktop
- [x] Tests : EventListPage en mobile (1 colonne, FAB visible), ParticipantList mobile (pas de table)

**Validation** : Events navigables et lisibles sur 320px.

---

## Session 4 : PlanningPage + TableDetailPage mobile-first

**Objectif** : Planning et detail table parfaits sur mobile.

- [x] `PlanningPage` : TimelineView 1 colonne mobile, FAB "Creer Table", headers jour sticky
- [x] `TableCard` : padding et tailles de texte responsive, `active:scale-95` au tap
- [x] `TableDetailPage` : participants en card list (pas table) sur mobile, boutons action `sticky bottom btn-block`
- [x] `CreateTableModal` + `EditTableModal` : MobileSheet sur mobile, grille datetime `grid-cols-1` -> `sm:grid-cols-2`
- [x] `TagInput` : taille cibles touch >= 44px
- [x] Tests : TableDetailPage mobile (pas de table HTML), boutons sticky

**Validation** : Planning utilisable au pouce sur mobile.

---

## Session 5 : Board Games + Notifications mobile-first

**Objectif** : Jeux et notifications parfaits sur mobile.

- [x] `BoardGameTab` : header responsive, bouton "Ajouter" adapte
- [x] `BoardGameList` + `BoardGameCard` : cartes avec taille touch suffisante, bouton supprimer agrandi
- [x] `AddBoardGameModal` : MobileSheet sur mobile
- [x] `BoardGameSearchInput` : dropdown adapte mobile (max-h responsive, position safe)
- [x] `NotificationBell` : dropdown -> bottom sheet sur mobile
- [x] `NotificationItem` : zones cliquables >= 44px, swipe-to-delete envisageable (optionnel)
- [x] Tests : BoardGameCard touch targets, NotificationBell mobile

**Validation** : Jeux et notifications utilisables sur mobile.

---

## Session 6 : Skeletons, empty states, feedback visuel

**Objectif** : Feedback utilisateur complet (loading, vide, erreurs).

- [x] Composant `Skeleton` reutilisable (card skeleton, list skeleton, text skeleton)
- [x] Skeletons dans : EventListPage, PlanningPage, TableDetailPage, BoardGameList, NotificationBell dropdown
- [x] Composant `EmptyState` reutilisable (icone + texte + CTA optionnel)
- [x] Empty states dans : EventListPage, PlanningPage, BoardGameList, ParticipantList, NotificationBell
- [x] `active:scale-95` sur tous les boutons et cartes cliquables
- [x] Transitions d'apparition (`animate-fade-in`) sur les contenus charges
- [x] Tests : skeletons affiches pendant loading, empty states affiches quand liste vide

**Validation** : Aucune page ne reste "blanche" pendant le chargement.

---

## Session 7 : Coherence visuelle, accessibilite, theme

**Objectif** : Audit global d'uniformite, accessibilite de base.

- [x] Audit couleurs : remplacer toute couleur hardcodee par variables DaisyUI
- [x] Audit arrondis : uniformiser (choix projet : `rounded-lg` pour les cartes, `rounded-xl` pour les modals/sheets)
- [x] Audit ombres : `shadow-sm` cartes, `shadow-lg` modals
- [x] `aria-label` sur tous les boutons icone-only
- [x] `role="dialog"` + `aria-modal` sur MobileSheet et modals
- [x] Focus trap dans MobileSheet
- [x] Labels `htmlFor` sur tous les inputs
- [x] Integration `vitest-axe` : test axe sur pages principales (0 erreur critique)
- [x] Tests : accessibilite axe-core sur MobileSheet, ResponsiveModal, NotificationItem, EmptyState, Skeleton

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
