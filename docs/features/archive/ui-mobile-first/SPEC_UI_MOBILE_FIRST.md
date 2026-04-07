# Spec : Phase 7 - UI Mobile-First & Polish

## Philosophie

TomManager est utilise principalement sur telephone pendant des events (conventions de jeux de societe). Le mobile n'est pas une degradation du desktop : **c'est l'experience principale**. Chaque composant est d'abord concu pour un ecran 320-428px, puis enrichi pour tablette et desktop.

**Regle** : on code d'abord les classes Tailwind sans prefix (= mobile), puis on ajoute `sm:`, `md:`, `lg:` pour enrichir.

---

## 1. Navigation mobile : Bottom Tab Bar + Drawer

### Mobile (< 768px)

La navbar top actuelle est remplacee par :

- **Header fixe** (top) : logo "TM" compact + NotificationBell + ConnectionStatus
- **Bottom Tab Bar** (fixe en bas, au-dessus du safe-area) :
  - Events (icone maison)
  - Planning (icone calendrier) — visible si dans un event
  - Games (icone de) — visible si dans un event
  - Profile (icone user) — username, logout

La bottom bar utilise `position: fixed; bottom: 0` avec `pb-safe` (safe area iOS). Chaque onglet = icone + label court. L'onglet actif est mis en surbrillance. Les pages ajoutent un `pb-20` pour eviter que le contenu soit cache par la bar.

### Desktop (>= 768px)

Navbar top classique conservee (comme actuellement) mais avec meilleur espacement.

---

## 2. Pages : redesign mobile-first

### 2.1 HomePage

**Mobile** : plein ecran, logo centre, bouton CTA large (`btn-block`). Texte `text-2xl` (pas `text-5xl`).
**Desktop** : hero centre avec plus d'espace, `text-4xl`.

### 2.2 Auth Pages (Login, Signup, InvitationLanding)

**Mobile** : carte pleine largeur (`w-full px-4`), pas de `w-96` fixe. Inputs pleine largeur, boutons `btn-block`. Espacement vertical genereux pour le pouce.
**Desktop** : `max-w-sm mx-auto` pour centrer.

### 2.3 EventListPage

**Mobile** : liste verticale de cartes pleine largeur (1 colonne). Bouton "Creer Event" = FAB (Floating Action Button) en bas a droite, rond, bien visible. Pas de header avec bouton.
**Desktop** : grille 2-3 colonnes. Bouton "Creer Event" dans le header.

### 2.4 EventDetailPage

**Mobile** : les onglets (Info, Planning, Games, Participants, Invitations) deviennent des **sections empilees verticalement** avec accordion/collapse, ou bien navigation via la bottom bar. Pas d'onglets horizontaux debordants.

Alternative retenue : **tabs scrollables horizontalement** avec `overflow-x-auto` et `scroll-snap-x`. Le tab actif est centre visuellement.

**Desktop** : onglets classiques horizontaux.

### 2.5 PlanningPage

**Mobile** : TimelineView en une seule colonne. TableCards empilees verticalement. Bouton "Creer Table" = FAB. Groupement par jour avec headers sticky.
**Desktop** : grille 2-3 colonnes. Bouton dans le header.

### 2.6 TableDetailPage

**Mobile** : sections empilees en cartes (infos, participants, actions). **Pas de table HTML** pour les participants — utiliser des cartes empilees (card list) avec nom, status, et action (bouton kick). Boutons d'action (join/leave) = boutons pleine largeur en bas de page (`sticky bottom`).
**Desktop** : layout actuel affine avec table pour les participants.

### 2.7 Modals -> Bottom Sheets (mobile)

**Mobile** : les modals deviennent des **bottom sheets** qui montent depuis le bas de l'ecran. Contenu scrollable dans le sheet. Hauteur max 90vh. Swipe-down pour fermer. Backdrop sombre.
**Desktop** : modals centres classiques (DaisyUI modal-box).

Composant generique `MobileSheet` qui encapsule la logique mobile/desktop.

---

## 3. Listes & donnees : cartes au lieu de tables

### ParticipantList

**Mobile** : chaque participant = une carte horizontale (avatar/initiale, username, role badge, action). Pas de `<table>`.
**Desktop** : table classique conservee.

### InvitationManager

**Mobile** : formulaire d'envoi en haut (input + bouton pleine largeur). Liste d'invitations = cartes empilees (email, status badge, date).
**Desktop** : formulaire inline + table.

---

## 4. Touch & interactions

### Taille des cibles tactiles

- **Minimum 44x44px** pour tout element interactif (norme Apple/Google)
- Remplacer `btn-xs` par `btn-sm` minimum sur mobile
- Badges avec action (X pour supprimer) : agrandir la zone cliquable avec padding invisible
- Tags : zone cliquable suffisante

### Feedback tactile

- Utiliser `active:scale-95` pour le feedback au tap (au lieu de hover)
- Les classes `pointer-coarse:` (deja dans tailwind config) pour cibler specifiquement le touch

### Swipe

- Swipe-down pour fermer les bottom sheets
- Eventuellement swipe-left sur les cartes de notification pour supprimer (v2)

---

## 5. Loading & empty states

### Skeletons

Squelettes de chargement pour :

- EventListPage : 3 cartes ghost
- PlanningPage : 2-3 cartes ghost
- TableDetailPage : sections ghost
- BoardGameList : 3 cartes ghost
- NotificationBell dropdown : 3 lignes ghost

Composant reutilisable `Skeleton` (DaisyUI a deja `skeleton` class).

### Empty states

Chaque liste vide affiche :

- Icone illustrative
- Texte explicatif
- CTA (bouton d'action) quand pertinent

Pages concernees : EventListPage, PlanningPage, BoardGameList, ParticipantList, NotificationBell.

---

## 6. Formulaires mobile-friendly

- Inputs en pleine largeur
- Labels au-dessus (jamais a cote)
- Espacement `space-y-4` pour le pouce
- Grilles 2 colonnes (datetime) -> 1 colonne sur mobile, 2 sur `sm:`
- `inputmode="email"` sur les champs email
- `inputmode="numeric"` sur maxPlayers
- Boutons d'action pleine largeur sur mobile (`btn-block`), normaux sur desktop

---

## 7. Coherence visuelle & theme DaisyUI

- Audit des couleurs : utiliser les variables DaisyUI (`primary`, `secondary`, `accent`, `base-*`) partout, jamais de couleurs hardcodees
- Audit des arrondis : uniformiser (`rounded-lg` ou `rounded-xl`)
- Audit des ombres : uniformiser (`shadow-sm` pour les cartes, `shadow-lg` pour les modals/sheets)
- Espacements : adopter une echelle coherente (4, 8, 12, 16, 24, 32)

---

## 8. Accessibilite (base)

- `aria-label` sur tous les boutons icone-only (NotificationBell, FAB, close buttons)
- `role="dialog"` + `aria-modal="true"` sur les modals/bottom sheets
- Focus trap dans les modals/bottom sheets
- `aria-live="polite"` sur le badge de notification pour les screen readers
- Labels `<label htmlFor>` sur tous les inputs de formulaire
- Contraste : verifier que les themes DaisyUI passent WCAG AA

---

## 9. Backend : ajustements legers

- Standardiser les erreurs (format unique `{ error: string, details?: unknown }`)
- Rate limiting sur les endpoints sensibles (`/api/auth/login`, `/api/auth/signup`)
- Pagination : tous les endpoints de liste supportent `?limit=` et `?cursor=` (certains l'ont deja)

---

## 10. PWA basique

- `manifest.json` avec nom, icones, couleurs, `display: standalone`
- Meta tags viewport et theme-color
- Indicateur offline simple (banner "Hors connexion" quand `navigator.onLine === false`)
- Pas de service worker complet / cache offline pour l'instant

---

## 11. Tests

### Frontend

- Tests de rendu des composants cles en contexte mobile (mock `matchMedia` ou `resize`)
- Tests des nouvelles interactions : bottom sheet open/close, FAB, bottom tab bar navigation
- Tests des empty states et skeletons

### Accessibilite

- Integration `vitest-axe` ou `@axe-core/react` pour les tests automatiques
- Tests sur les pages principales : pas d'erreur axe critique

### E2E (stretch goal)

- Flow complet mobile : login -> events -> planning -> creer table -> rejoindre -> jeux
