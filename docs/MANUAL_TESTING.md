# TomManager - Plan de Test Manuel Complet

## Pre-requis

- Application demarree : `npm run docker:up:build`
- Navigateur desktop + DevTools mobile (320px, 375px, 768px)
- 2 onglets/navigateurs pour tester le temps reel
- Compte ADMIN cree (premier utilisateur via seed ou modification DB)

---

## 1. Authentification

### 1.1 Page d'accueil

- [X] La HomePage s'affiche avec le titre et le CTA "Commencer"
- [ ] Mobile : texte `text-2xl`, bouton pleine largeur
- [ ] Desktop : texte `text-4xl`, bouton taille normale
- [ ] Pas de scroll horizontal sur 320px

### 1.2 Inscription (via invitation uniquement)

- [x] Acceder a `/signup` sans token → redirige ou affiche erreur
- [x] Acceder a `/signup?token=INVALID` → erreur "Token invalide"
- [ ] Avec un token valide :
  - [ ] Email pre-rempli et non modifiable
  - [ ] Remplir username + password → inscription reussie
  - [ ] Redirection vers la page de l'event automatiquement
  - [ ] Session creee (cookie `connect.sid`)
- [ ] Inscription avec email different du token → erreur 403
- [ ] Inscription avec username deja pris → erreur 409
- [ ] Inscription avec email deja pris → erreur 409
- [ ] Mobile : card pleine largeur, inputs `btn-block`, `inputmode="email"`
- [ ] Desktop : card centree `max-w-sm`

### 1.3 Connexion

- [ ] Login avec email valide → succes
- [ ] Login avec username valide → succes
- [ ] Login avec mauvais mot de passe → erreur 401
- [ ] Login avec identifiant inexistant → erreur 401
- [ ] Login avec token d'invitation :
  - [ ] Participation a l'event creee automatiquement
  - [ ] Redirection vers `/events/:eventId`
  - [ ] Token deja utilise → login OK, participation existante inchangee
- [ ] Login sans token → redirection vers `/`
- [ ] Mobile : formulaire pleine largeur
- [ ] Desktop : formulaire centre

### 1.4 Deconnexion

- [ ] Bouton logout → session detruite
- [ ] Apres logout, acces a une page protegee → redirection login
- [ ] Cookie `connect.sid` supprime

### 1.5 Session

- [ ] Rafraichir la page → session restauree (GET `/api/auth/me`)
- [ ] Apres 1h d'inactivite → session expiree, redirection login
- [ ] Appel API sans session → 401

---

## 2. Gestion des Evenements

### 2.1 Liste des evenements

- [ ] USER voit uniquement ses events (ou il est participant)
- [ ] ADMIN voit tous les events
- [ ] Filtre `?upcoming=true` : n'affiche que les events futurs
- [ ] Mobile : liste 1 colonne, cartes pleine largeur
- [ ] Desktop : grille 2-3 colonnes
- [ ] FAB "Creer un event" visible pour ADMIN uniquement (mobile)
- [ ] Bouton "Creer" dans le header (desktop)
- [ ] Skeleton loading affiche pendant le chargement
- [ ] Empty state "Aucun evenement" si liste vide

### 2.2 Creation d'event (ADMIN)

- [ ] Modal/sheet s'ouvre au clic sur le bouton creer
- [ ] Champs : nom (1-100 chars), date debut, date fin
- [ ] Nom vide → erreur
- [ ] Nom > 100 chars → erreur
- [ ] Date fin avant date debut → erreur
- [ ] Date invalide → erreur
- [ ] Creation reussie → event apparait dans la liste
- [ ] Le createur est auto-ajoute comme participant
- [ ] Mobile : bottom sheet
- [ ] Desktop : modal centree

### 2.3 Detail d'event

- [ ] Participant peut voir le detail
- [ ] Non-participant → erreur 403
- [ ] ADMIN peut voir tous les events
- [ ] Onglets : Info | Planning | Jeux | Participants | Invitations (createur)
- [ ] Mobile : onglets scrollables horizontalement avec snap
- [ ] Desktop : onglets classiques
- [ ] Event inexistant → 404

### 2.4 Modification d'event (Createur)

- [ ] Modifier le nom → succes
- [ ] Modifier les dates → succes
- [ ] Les invitations PENDING ont leur `expiresAt` mis a jour
- [ ] Les tables de jeu sont recadrees dans les nouvelles dates
- [ ] Table devenue invalide (start >= end apres recadrage) → supprimee
- [ ] Non-createur ne peut pas modifier → 403
- [ ] Mobile : bottom sheet
- [ ] Desktop : modal

### 2.5 Suppression d'event (Createur)

- [ ] Confirmation demandee avant suppression
- [ ] Suppression cascade : participations, invitations, tables
- [ ] Redirection vers la liste des events
- [ ] Non-createur ne peut pas supprimer → 403

---

## 3. Invitations

### 3.1 Envoi d'invitation (Createur)

- [ ] Saisir un email valide → invitation creee
- [ ] Email invalide → erreur de format
- [ ] Email manquant → erreur
- [ ] Invitation deja PENDING pour cet email/event → 409
- [ ] Invitation EXPIRED pour cet email → ancienne supprimee, nouvelle creee
- [ ] Lien d'invitation genere et copiable

### 3.2 Page d'invitation (`/invite/:token`)

- [ ] Token valide, pas de compte → redirection `/signup?token=...&email=...`
- [ ] Token valide, compte existant → redirection `/login?token=...`
- [ ] Token invalide → message d'erreur
- [ ] Token expire → message "Invitation expiree" (410)
- [ ] Token deja utilise → message "Invitation deja acceptee" (409)

### 3.3 Liste des invitations (Createur)

- [ ] Affiche toutes les invitations de l'event
- [ ] Statuts affiches : PENDING, ACCEPTED, EXPIRED
- [ ] Mobile : liste de cartes
- [ ] Desktop : tableau
- [ ] Non-createur ne voit pas l'onglet invitations

---

## 4. Participants

### 4.1 Liste des participants

- [ ] Affiche tous les participants avec username, role, date d'inscription
- [ ] Mobile : cartes empilees (pas de tableau HTML)
- [ ] Desktop : tableau HTML
- [ ] Non-participant ne peut pas voir → 403

### 4.2 Retirer un participant (Createur)

- [ ] Retirer un participant → suppression + cascade tables
- [ ] Si le participant etait CONFIRMED dans une table → promotion du premier WAITLIST
- [ ] Le createur ne peut pas se retirer lui-meme → 403
- [ ] Non-createur ne peut pas retirer → 403
- [ ] Participant inexistant → 404
- [ ] Notification envoyee au participant retire

### 4.3 Quitter un event (Participant)

- [ ] Bouton "Quitter" → quitte l'event
- [ ] Cascade : supprime les participations aux tables
- [ ] Le createur ne peut pas quitter son event → 403
- [ ] Redirection vers la liste des events

---

## 5. Planning (Tables de jeu)

### 5.1 Liste des tables

- [ ] Affiche toutes les tables de l'event en timeline
- [ ] Mobile : 1 colonne, headers de jour sticky, FAB "Creer table"
- [ ] Desktop : grille 2-3 colonnes
- [ ] Chaque carte : titre, MJ, horaire, nb joueurs/max
- [ ] Skeleton loading pendant le chargement
- [ ] Empty state si aucune table
- [ ] `active:scale-95` au tap sur les cartes

### 5.1b Vue Calendrier (FullCalendar)

**Toggle et preference**
- [ ] Bouton toggle liste/calendrier visible en haut a gauche du planning
- [ ] Basculer vers "calendrier" → vue FullCalendar s'affiche
- [ ] Basculer vers "liste" → TimelineView s'affiche a nouveau
- [ ] Rafraichir la page → la derniere vue choisie est restauree (localStorage)

**Affichage desktop (>= 768px)**
- [ ] Toutes les journees de l'event affiches en colonnes cote a cote
- [ ] Axe horaire a gauche (labels toutes les heures, format 24h)
- [ ] Tables simultanees affichees en colonnes cote a cote (pas superposees)
- [ ] Scroll automatique vers la premiere table (ou le debut de l'event si vide)
- [ ] Indicateur "maintenant" (ligne rouge) si l'event est en cours

**Affichage mobile (< 768px)**
- [ ] Une seule journee affichee a la fois
- [ ] Boutons < > pour naviguer entre les jours
- [ ] Le header affiche le jour courant (ex: "lundi 14 janvier")
- [ ] Impossible de naviguer avant le debut ou apres la fin de l'event

**Color coding**
- [ ] Table dont l'user est MJ → couleur secondary
- [ ] Table ou l'user est inscrit (CONFIRMED) → couleur success
- [ ] Table ou l'user est en waitlist → couleur warning
- [ ] Autre table → couleur primary (semi-transparente)

**Contenu des blocs**
- [ ] Titre tronque si trop long
- [ ] Plage horaire (timeText FC)
- [ ] Compteur joueurs confirmes/max (+ waitlist si >0)
- [ ] Clic sur un bloc → navigation vers le detail de la table

**Drag & drop**
- [ ] MJ peut drag sa propre table → nouveau creneau
- [ ] Admin peut drag n'importe quelle table
- [ ] Participant non-MJ : drag bloque (bloc non draggable)
- [ ] Snap a 15 minutes au relache
- [ ] Impossible de deposer hors de la plage de l'event (zone grisee/bloquee)
- [ ] Drag reussi → PATCH API + table mise a jour pour tous (temps reel)
- [ ] Erreur API → revert visuel + toast d'erreur
- [ ] Chevauchement avec une autre table du meme MJ → toast warning (action autorisee quand meme)

**Resize**
- [ ] MJ peut tirer le bas d'un bloc pour changer la duree
- [ ] Admin peut resizer n'importe quel bloc
- [ ] Snap 15 min au relache
- [ ] Impossible de depasser la fin de l'event
- [ ] Resize reussi → PATCH API + mise a jour temps reel
- [ ] Erreur API → revert visuel + toast d'erreur

**Temps reel (calendrier ouvert)**
- [ ] Un autre user deplace une table → calendrier mis a jour sans rafraichir
- [ ] Une nouvelle table est creee → apparait dans le calendrier
- [ ] Une table est supprimee → disparait du calendrier

**Mobile drag (< 768px)**
- [ ] Long press (500ms) sur un bloc editable → initie le drag
- [ ] Drag touch fonctionne de la meme maniere que desktop

### 5.2 Creation de table

- [ ] Champs : titre (1-150), pitch (max 2000), triggers (max 1000), commentaires (max 1000), maxPlayers (1-20), dates debut/fin, tags
- [ ] Titre vide → erreur
- [ ] Titre > 150 chars → erreur
- [ ] maxPlayers hors range → erreur
- [ ] Dates hors bornes de l'event → erreur
- [ ] Date fin avant date debut → erreur
- [ ] Tags : autocomplete avec recherche, creation a la volee
- [ ] Mobile : bottom sheet, grille dates 1 colonne
- [ ] Desktop : modal, grille dates 2 colonnes
- [ ] Le createur est MJ mais PAS ajoute comme participant

### 5.3 Detail de table

- [ ] Affiche : titre, pitch, triggers, commentaires, MJ, horaire, tags
- [ ] Participants : section Confirmes + section Liste d'attente
- [ ] Mobile : cartes participants (pas de tableau), boutons sticky en bas
- [ ] Desktop : tableau participants
- [ ] Boutons action : Rejoindre/Quitter (participant), Modifier/Supprimer (MJ/admin)
- [ ] Table inexistante → 404

### 5.4 Rejoindre une table

- [ ] Places disponibles → statut CONFIRMED
- [ ] Table pleine → statut WAITLIST
- [ ] Deja participant → erreur 409
- [ ] MJ essaie de rejoindre sa propre table → erreur 400
- [ ] Non-participant de l'event → erreur 403
- [ ] Mise a jour temps reel pour tous les participants de l'event

### 5.5 Quitter une table

- [ ] Quitter en tant que CONFIRMED → place liberee
- [ ] Si des joueurs en WAITLIST → premier promu en CONFIRMED
- [ ] Notification envoyee au joueur promu
- [ ] Mise a jour temps reel

### 5.6 Expulser un joueur (MJ/Admin)

- [ ] MJ peut expulser un joueur de sa table
- [ ] ADMIN peut expulser de n'importe quelle table
- [ ] Si le joueur etait CONFIRMED → promotion WAITLIST
- [ ] Notification PLAYER_KICKED envoyee au joueur expulse
- [ ] Non-MJ non-admin → 403

### 5.7 Modification de table (MJ/Admin)

- [ ] Modifier titre, pitch, triggers, commentaires → succes
- [ ] Modifier maxPlayers a la baisse (moins que le nb de confirmes) :
  - [ ] Les derniers confirmes sont retrogrades en WAITLIST
  - [ ] Notification WAITLIST_DEMOTED envoyee
- [ ] Modifier maxPlayers a la hausse :
  - [ ] Les premiers en WAITLIST sont promus en CONFIRMED
  - [ ] Notification WAITLIST_PROMOTED envoyee
- [ ] Modifier les dates → validation des bornes
- [ ] Non-MJ non-admin → 403
- [ ] Notification TABLE_UPDATED envoyee a tous les participants

### 5.8 Suppression de table (MJ/Admin)

- [ ] Supprimer la table → cascade suppression participants
- [ ] Notification TABLE_DELETED envoyee a tous les participants
- [ ] Mise a jour temps reel
- [ ] Non-MJ non-admin → 403

### 5.9 Cascades

- [ ] Modification dates event → tables recadrees ou supprimees
- [ ] Suppression event → toutes les tables supprimees
- [ ] Retrait participant de l'event → ses tables supprimees + ses participations retirees
- [ ] Si retrait d'un CONFIRMED d'une table → promotion WAITLIST

---

## 6. Jeux de Societe

### 6.1 Recherche de jeux

- [ ] Recherche texte → resultats locaux affiches
- [ ] Si < 10 resultats locaux → fallback BGG automatique
- [ ] Deduplication entre local et BGG (par externalId)
- [ ] Recherche vide → aucun resultat
- [ ] Mobile : dropdown adapte (max-h responsive)
- [ ] Desktop : dropdown standard

### 6.2 Detail d'un jeu

- [ ] Jeu local avec description → affiche directement
- [ ] Jeu BGG stub (sans description) → lazy fetch depuis BGG
- [ ] Apres enrichissement → les donnees sont persistees
- [ ] Jeu inexistant → 404

### 6.3 Creation manuelle

- [ ] Nom requis → creation reussie
- [ ] Nom vide → erreur
- [ ] Champs optionnels : annee, joueurs min/max, duree, description, image
- [ ] Le jeu cree n'a pas d'externalSource

### 6.4 Ajout a un event

- [ ] Ajouter un jeu existant → succes
- [ ] Ajouter le meme jeu 2 fois par le meme user → 409
- [ ] 2 users differents peuvent ajouter le meme jeu → OK
- [ ] boardGameId inexistant → erreur
- [ ] Non-participant → 403

### 6.5 Liste des jeux d'un event

- [ ] Affiche les jeux groupes par nom avec "apporte par"
- [ ] Mobile : cartes avec image, nom, annee, bouton supprimer
- [ ] Desktop : tableau
- [ ] Empty state si aucun jeu
- [ ] Skeleton loading pendant le chargement

### 6.6 Retrait d'un jeu

- [ ] Le proprietaire peut retirer son jeu → 204
- [ ] ADMIN peut retirer n'importe quel jeu → 204
- [ ] Non-proprietaire non-admin → 403
- [ ] Cascade : retrait du participant de l'event → ses jeux retires

---

## 7. Temps Reel (Socket.io)

### 7.1 Connexion

- [ ] Indicateur ConnectionStatus visible (point vert = connecte)
- [ ] Deconnexion → indicateur orange "Reconnexion..."
- [ ] Reconnexion automatique apres perte de connexion
- [ ] Sans session → connexion Socket.io refusee

### 7.2 Mises a jour en temps reel

Ouvrir 2 navigateurs/onglets avec 2 users differents sur le meme event.

**Tables :**
- [ ] User A cree une table → apparait chez User B sans rafraichir
- [ ] User A modifie une table → mise a jour chez User B
- [ ] User A supprime une table → disparait chez User B
- [ ] User A rejoint une table → compteur mis a jour chez User B
- [ ] User A quitte une table → compteur mis a jour chez User B

**Jeux :**
- [ ] User A ajoute un jeu → apparait chez User B
- [ ] User A retire un jeu → disparait chez User B

**Participants :**
- [ ] Admin retire User B → User B recoit une notification temps reel

### 7.3 Rooms Socket.io

- [ ] Naviguer vers un event → rejoint la room `event:{eventId}`
- [ ] Naviguer ailleurs → quitte la room
- [ ] Evenements recus uniquement dans la room appropriee

---

## 8. Notifications

### 8.1 Cloche de notification

- [ ] Badge rouge avec compteur d'unread affiche
- [ ] Compteur se met a jour en temps reel
- [ ] Mobile : dans le header fixe en haut
- [ ] Desktop : dans la navbar
- [ ] Clic → ouvre le dropdown/sheet

### 8.2 Liste des notifications

- [ ] Affiche les notifications avec icone, titre, message, horodatage
- [ ] Notifications non lues : texte gras / bordure bleue
- [ ] Clic sur notification → marque comme lue + navigation vers la ressource
- [ ] Bouton supprimer (X) → supprime la notification
- [ ] Bouton "Tout marquer comme lu" → toutes les notifs marquees lues
- [ ] Scroll infini / pagination
- [ ] Empty state "Aucune notification"
- [ ] Mobile : bottom sheet
- [ ] Desktop : dropdown

### 8.3 Types de notifications (verification par declencheur)

- [ ] Suppression de table → TABLE_DELETED recue par les participants
- [ ] Modification de table → TABLE_UPDATED recue par les participants
- [ ] Promotion waitlist → WAITLIST_PROMOTED recue par le promu
- [ ] Retrogradation → WAITLIST_DEMOTED recue par les retrogrades
- [ ] Expulsion → PLAYER_KICKED recue par l'expulse
- [ ] Retrait de participant → PARTICIPANT_REMOVED recue par le retire
- [ ] L'auteur de l'action ne recoit PAS sa propre notification

### 8.4 Navigation depuis notification

- [ ] Notification TABLE_DELETED → navigation vers l'event (table n'existe plus)
- [ ] Notification TABLE_UPDATED → navigation vers la table
- [ ] Notification PLAYER_KICKED → navigation vers l'event
- [ ] Notification sur ressource supprimee → gerer gracieusement le 404

---

## 9. UI Mobile-First

### 9.1 Navigation mobile (< 768px)

- [ ] Header fixe en haut : logo TM, NotificationBell, ConnectionStatus
- [ ] Bottom tab bar fixe : Events, Planning, Jeux, Profil
- [ ] Onglet actif surbrille
- [ ] Contenu ne passe pas sous la tab bar (padding-bottom)
- [ ] Contenu ne passe pas sous le header (padding-top)
- [ ] Pas de scroll horizontal sur aucune page (320px)

### 9.2 Navigation desktop (>= 768px)

- [ ] Navbar classique en haut
- [ ] Pas de bottom tab bar
- [ ] Liens de navigation dans la navbar

### 9.3 Bottom Sheets (mobile)

- [ ] Tous les modals deviennent des bottom sheets sur mobile
- [ ] Apparition depuis le bas avec animation
- [ ] Fermeture : bouton X, clic sur backdrop, touche Escape
- [ ] Focus trap : Tab/Shift+Tab boucle dans le sheet
- [ ] Max hauteur 90vh, scroll interne
- [ ] `role="dialog"` + `aria-modal="true"`

### 9.4 FAB (Floating Action Button)

- [ ] Position fixe en bas a droite, au-dessus de la tab bar
- [ ] Taille 56px minimum
- [ ] Shadow visible
- [ ] `aria-label` present

### 9.5 Touch targets

- [ ] Tous les boutons et zones cliquables >= 44x44px
- [ ] Tags dans TagInput >= 44px
- [ ] Boutons supprimer dans les listes assez grands
- [ ] `active:scale-95` sur les boutons et cartes cliquables

### 9.6 Skeletons & empty states

- [ ] EventListPage : skeleton cards pendant le chargement
- [ ] PlanningPage : skeleton cards pendant le chargement
- [ ] BoardGameList : skeleton cards pendant le chargement
- [ ] NotificationBell : skeleton lignes pendant le chargement
- [ ] TableDetailPage : skeleton sections pendant le chargement
- [ ] Chaque liste vide affiche un empty state avec icone + texte + CTA optionnel

### 9.7 Feedback visuel

- [ ] `active:scale-95` sur les boutons au tap
- [ ] Transitions `animate-fade-in` sur les contenus charges
- [ ] Boutons disabled : opacity reduite, cursor not-allowed

---

## 10. Accessibilite

### 10.1 ARIA

- [ ] Tous les boutons icone-only ont un `aria-label`
- [ ] Modals/sheets : `role="dialog"` + `aria-modal="true"`
- [ ] Focus trap dans MobileSheet et modals
- [ ] Badge notification : `aria-live="polite"` (si applicable)

### 10.2 Formulaires

- [ ] Tous les inputs ont un `<label htmlFor>`
- [ ] Messages d'erreur lies aux inputs
- [ ] Navigation clavier Tab/Shift+Tab fonctionnelle

### 10.3 Contraste & couleurs

- [ ] Pas de couleurs hardcodees (tout via DaisyUI)
- [ ] Arrondis uniformes : `rounded-lg` cartes, `rounded-xl` modals
- [ ] Ombres uniformes : `shadow-sm` cartes, `shadow-lg` modals
- [ ] Focus ring visible sur tous les elements interactifs

---

## 11. PWA & Offline

### 11.1 Manifest

- [ ] `manifest.json` accessible a `/manifest.json`
- [ ] Contenu : nom, short_name, theme_color, display standalone, icones
- [ ] Icone SVG charge correctement

### 11.2 Meta tags

- [ ] `theme-color` present dans le `<head>`
- [ ] `apple-mobile-web-app-capable` present
- [ ] `apple-mobile-web-app-status-bar-style` present
- [ ] `<link rel="manifest">` present
- [ ] `<link rel="apple-touch-icon">` present

### 11.3 Indicateur offline

- [ ] Couper le reseau (DevTools) → banner "Hors connexion" affichee
- [ ] Banner fixe en haut, couleur warning, z-index au-dessus de tout
- [ ] Contenu decale vers le bas pour ne pas etre cache
- [ ] Remettre le reseau → banner disparait

---

## 12. Backend Polish

### 12.1 Format d'erreurs

- [ ] Toutes les erreurs API retournent `{ error: { message: "..." } }`
- [ ] Verifier sur : login invalide, signup sans token, creation jeu sans bggId
- [ ] Pas de `{ error: "string" }` (ancien format)

### 12.2 Rate limiting

- [ ] POST `/api/auth/login` : 10 tentatives max en 15 min
- [ ] POST `/api/auth/signup` : 10 tentatives max en 15 min
- [ ] 11eme tentative → 429 Too Many Requests
- [ ] Headers `RateLimit-*` presents dans les reponses

### 12.3 Parametre `?limit=`

- [ ] GET `/api/events?limit=2` → retourne max 2 events
- [ ] GET `/api/events/:id/tables?limit=2` → retourne max 2 tables
- [ ] GET `/api/events/:id/participants?limit=2` → retourne max 2 participants
- [ ] GET `/api/events/:id/boardgames?limit=2` → retourne max 2 jeux
- [ ] GET `/api/notifications?limit=5` → retourne max 5 notifications
- [ ] `?limit=0` ou `?limit=-1` → erreur 400
- [ ] `?limit=abc` → erreur 400
- [ ] Sans `?limit=` → retourne tout (comportement par defaut)

---

## 13. Cas limites & concurrence

### 13.1 Cascades critiques

- [ ] Supprimer un event → toutes les tables + participations + invitations supprimees
- [ ] Retirer un participant → ses tables (creees par lui) supprimees
- [ ] Retirer un participant → ses participations aux tables supprimees
- [ ] Retirer un CONFIRMED d'une table → premier WAITLIST promu

### 13.2 Race conditions

- [ ] 2 users rejoignent la meme table en meme temps (1 place restante)
  - [ ] Un seul obtient CONFIRMED, l'autre WAITLIST
- [ ] Un user quitte une table pendant qu'un autre rejoint
  - [ ] Etats coherents pour les deux

### 13.3 Sessions multi-onglets

- [ ] Meme session partagee entre onglets
- [ ] Logout dans un onglet → l'autre onglet recoit 401 au prochain appel
- [ ] Rafraichissement restaure l'etat correct

---

## 14. Verification finale

### 14.1 Qualite du code

- [ ] `npm test` → tous les tests passent (225 tests)
- [ ] `npx tsc --noEmit` → 0 erreurs (backend + frontend)
- [ ] `npm run lint` → 0 erreurs (backend + frontend)

### 14.2 Viewports a tester

- [ ] 320px (iPhone SE)
- [ ] 375px (iPhone 12/13)
- [ ] 428px (iPhone 14 Pro Max)
- [ ] 768px (iPad)
- [ ] 1024px+ (Desktop)
- [ ] Orientation paysage sur mobile

### 14.3 Navigateurs

- [ ] Chrome (desktop + mobile)
- [ ] Firefox (desktop)
- [ ] Safari (iOS)
- [ ] Edge (desktop)
