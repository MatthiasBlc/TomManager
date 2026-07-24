# File Map - Arborescence source

## Backend (backend/src/)

```
src/
├── server.ts              # Entry point, HTTP server
├── app.ts                 # Express app, middleware, routes (+ /api/test si ENABLE_TEST_ROUTES)
├── config/
│   └── env.ts             # Environment validation (envalid)
├── controllers/
│   ├── auth.ts            # login, logout, me
│   ├── discordAuth.ts     # OAuth Discord (initiate, callback, unlink)
│   ├── adminSync.ts       # Sync manuelle membres Discord -> DB
│   ├── adminBoardGame.ts  # Admin: list/update/delete/merge board games
│   ├── event.ts           # CRUD event + purge (etend au contenu cuisine, cf services/event.ts)
│   ├── gameTable.ts       # CRUD table + join/leave/kick/status
│   ├── participant.ts     # list, remove, leave participants
│   ├── preference.ts      # update user preferences (toggles admin/beta)
│   ├── tag.ts             # tag autocomplete search
│   ├── boardGame.ts       # search, detail, create, findOrCreateBGG
│   ├── eventBoardGame.ts  # add, list, remove event board games
│   ├── notification.ts    # list, unreadCount, markAsRead, markAllAsRead, delete
│   ├── kitchen.ts         # module cuisine (CookV1) : GET config, PATCH config, chefs, courses, generate, reset
│   ├── meal.ts            # PATCH/DELETE repas + claim + inscriptions equipier (self ou manager-assign/remove tiers) (CookV1) — pas de creation manuelle (tous les repas naissent de generate)
│   ├── mealSwap.ts        # echange de creneau chefs : create/list/accept/reject/cancel + moveToOrphan (deplacement instantane, Evolutions.md point 1) (CookV1)
│   ├── assistantSwap.ts   # echange entre equipiers : create/list/accept/cancel (cible un repas, pas une personne, Evolutions.md point 4)
│   ├── product.ts         # autocomplete produits ingredients (CookV1)
│   └── utensil.ts         # autocomplete ustensiles (CookV1, Evolutions.md point 7)
├── middleware/
│   ├── auth.ts            # requireAuth, requireAdmin, requireEventParticipant, requireEventCreator, requireTableGMOrAdmin, requireKitchenManager, requireMealChefOrManager
│   ├── errorHandler.ts    # Global error handler
│   ├── rateLimiter.ts     # authRateLimiter (15min window, 10 req, skipped in test)
│   └── validateBody.ts    # validateBody(zodSchema), validateUUID(param)
├── routes/
│   ├── index.ts           # Main router
│   ├── auth.ts            # Auth routes (login, logout, me, discord)
│   ├── admin.ts           # Admin routes (discord/sync, boardgames CRUD + merge)
│   ├── event.ts           # Event routes (CRUD + purge)
│   ├── gameTable.ts       # GameTable routes (CRUD + join/leave/kick/status)
│   ├── participant.ts     # Participant routes (list, remove, leave)
│   ├── preference.ts      # PATCH /api/me/preferences
│   ├── tag.ts             # Tag routes (autocomplete)
│   ├── boardGame.ts       # BoardGame routes (search, detail, create, from-bgg)
│   ├── eventBoardGame.ts  # EventBoardGame routes (add, list, remove)
│   ├── notification.ts    # Notification routes (list, count, read, readAll, delete)
│   ├── kitchen.ts         # Kitchen + meal routes (config, chefs, courses, generate/reset, meals PATCH/DELETE/move, assistants self+manager, swaps, assistant-swaps)
│   ├── product.ts         # GET /api/kitchen/products (autocomplete)
│   ├── utensil.ts         # GET /api/kitchen/utensils (autocomplete, CookV1)
│   └── test.ts            # Seed E2E (seed-admin, seed-participant) — test/dev only
├── schemas/
│   ├── auth.ts            # loginSchema (zod)
│   ├── event.ts           # create/update event schemas
│   ├── gameTable.ts       # create/update table + status schemas
│   ├── preference.ts      # PREFERENCE_KEYS (liste blanche) + updatePreferencesSchema
│   ├── boardGame.ts       # boardgame schemas + updateBoardGameAdminSchema + mergeSchema
│   └── kitchen.ts         # config, chef/courses member, update meal, createSwapRequestSchema (ingredients/utensils, reutilise pour assistant-swaps) (ingredients/utensils) — createMealSchema retire (creation manuelle retiree)
├── services/
│   ├── auth.ts            # Auth business logic
│   ├── discordAuth.ts     # OAuth Discord (token exchange, role sync, link/unlink)
│   ├── adminSync.ts       # Discord guild members sync + getLocalUserIdsForDiscordRole (kitchen)
│   ├── adminBoardGame.ts  # Admin board game list/update/delete/merge
│   ├── event.ts           # Event CRUD + purge (garde EventKitchen+chefRoleId, purge repas/courses/chefs MANUAL, resync ROLE) + cascade to GameTables
│   ├── gameTable.ts       # GameTable CRUD, join/leave/kick, waitlist
│   ├── participant.ts     # Participant management + cascade to GameTables
│   ├── preference.ts      # get/update preferences (map complete, upsert, controle role)
│   ├── tag.ts             # Tag find-or-create, search
│   ├── bgg.ts             # BGG XML API client (search, thing detail)
│   ├── boardGame.ts       # BoardGame CRUD, search (local + BGG fallback)
│   ├── eventBoardGame.ts  # EventBoardGame CRUD (add/list/remove per event)
│   ├── notification.ts    # Notification CRUD, bulk create, cursor pagination
│   ├── kitchen.ts         # Config + roster chef (manuel/role, auto-claim orphelin manuel + auto-unassign courses, Evolutions.md point 3) + courses + vue par role (capacitySummary manager, computeRosterLists partage manager/dashboard admin), meals enrichis conflits, assertParticipant + computeAvailablePool + cancelStaleAssistantSwapRequests exportes (CookV1) ; dashboard (hasAdminOverview = isAdmin && !manager) cumulatif avec le role chef, plus exclusif
│   ├── meal.ts            # Meal PATCH/DELETE, claimMeal, join/move/leave transactionnel (self ou manager sur un tiers, annule les demandes d'echange equipier perimees) ; champs structurants manager-only (CookV1)
│   ├── mealTransfer.ts    # Helpers partages lockMealRow(s)Sorted/moveRecipeByPk/swapRecipesByPk, extraits de meal.ts+mealSwap.ts (prerequis points 1+4)
│   ├── mealSwap.ts        # Echange de creneau entre chefs : create/list/accept/reject/cancel + moveToOrphanMeal (deplacement instantane vers un creneau libre, Evolutions.md point 1)
│   ├── assistantSwap.ts   # Echange entre equipiers : create/list/accept/cancel — cible un repas (n'importe quel assistant du repas cible peut accepter), echange 1-pour-1 MealAssistant.mealId (Evolutions.md point 4)
│   ├── product.ts         # Product find-or-create + search, pattern Tag (CookV1)
│   ├── utensil.ts         # Utensil find-or-create + search, pattern Product/Tag (CookV1, Evolutions.md point 7)
│   ├── kitchenPlanning.ts # Generation/reset planning : computeExpectedSlots (grille Paris) + computeMealCapacities + generatePlanning idempotent + resetPlanning (supprime tous les repas, garde rosters) + slotKey (CookV1)
│   └── conflicts.ts       # Moteur de conflits UNIFIE tables+cuisine : getEventOccupations + computeConflicts (CookV1 Lot F), partage par gameTable.ts et kitchen.ts
├── socket/
│   ├── index.ts           # Socket.io setup, session auth, room handlers (event + user rooms), getIO()
│   └── emitter.ts         # emitToEvent, emitToUser helpers for services
├── types/
│   └── express-session.d.ts  # Session type augmentation
├── util/
│   ├── db.ts              # PrismaClient singleton
│   ├── logger.ts          # Pino logger
│   ├── sentry.ts          # Sentry init
│   └── timezone.ts        # getZoneOffsetMs/zonedWallClockToUtc (double passe DST)/zonedYMD/TZ — extrait de kitchenPlanning.ts (ParisTimezone), partage backend
└── __tests__/
    ├── setup/             # globalSetup (DB cleanup), testHelpers (supertest)
    └── integration/
        ├── health.test.ts, auth.test.ts, discordAuth.test.ts
        ├── event.test.ts, gameTable.test.ts, participant.test.ts
        ├── boardGame.test.ts, eventBoardGame.test.ts, adminBoardGame.test.ts
        ├── socket.test.ts, notification.test.ts, validation.test.ts, preference.test.ts
        ├── kitchen.test.ts (dont dashboard nominatif admin simple, auto-unassign courses, auto-claim chef manuel), meal.test.ts (claim + manager assign/remove assistant), mealSwap.test.ts (dont moveToOrphanMeal), kitchenPlanning.test.ts (grille + idempotence + reset)
        ├── assistantSwap.test.ts (create/accept/cancel, staleness, auto-cancel cascade sur leave/move/role-grant)
        └── kitchenConflicts.test.ts (conflits cross-domaine tables<->cuisine), kitchenPurge.test.ts (purge etendue, sync ROLE mockee, cascade AssistantSwapRequest)
```

Unitaires purs (`src/__tests__/unit/`) : `kitchenPlanning.test.ts` (computeMealCapacities + computeExpectedSlots), `conflicts.test.ts` (computeConflicts), `timezone.test.ts` (cas aux bornes DST 2026, ParisTimezone).

## Discord Bot (discord-bot/src/)

Client bot separe (discord.js), meme DB que le backend (`prisma/schema.prisma` copie/tenu a
jour manuellement en parallele de celui du backend — regenerer le client apres tout
changement de schema : `npx prisma generate`).

```
src/
├── index.ts                        # Client discord.js, startupSync au ready, listeners
├── handlers/
│   └── guildMemberUpdate.ts        # Diff roles ajoutes/retires -> sync participation + chef cuisine + admin
├── services/
│   ├── syncParticipation.ts        # handleRoleAdded/Removed (participation event), handleAdminRoleChange
│   ├── syncKitchenChef.ts          # handleChefRoleAdded/Removed (roster KitchenChef ROLE, CookV1) — materializeRoleChef annule aussi les demandes d'echange equipier en attente du nouveau chef (Evolutions.md point 4, duplique du backend car process/Prisma client separe)
│   └── startupSync.ts              # Reconciliation complete au demarrage (events + rosters chef)
├── util/
│   ├── db.ts                       # PrismaClient singleton
│   └── env.ts                      # Env validation
└── __tests__/
    ├── handlers/guildMemberUpdate.test.ts
    └── services/syncParticipation.test.ts, syncKitchenChef.test.ts, startupSync.test.ts
```

## Frontend (frontend/src/)

```
src/
├── main.tsx               # Entry point
├── App.tsx                # Router + AuthProvider + Toaster + offline banner
├── vite-env.d.ts          # Vite types
├── config/
│   ├── api.ts             # Axios instance
│   └── apiErrors.ts       # Mapping code erreur backend -> message francais + getErrorMessage
├── components/
│   ├── admin/
│   │   └── AdminBoardGamePanel.tsx    # Gestion base de jeux (recherche, edit, delete, merge) — admin + toggle gameDb
│   ├── common/
│   │   ├── ConnectionStatus.tsx   # WebSocket connection indicator
│   │   ├── ErrorBoundary.tsx      # React error boundary
│   │   ├── InfoTooltip.tsx        # Icone info + infobulle (hover desktop, tap mobile)
│   │   ├── PrivateRoute.tsx       # Route guard (redirect si non connecte)
│   │   ├── MobileSheet.tsx        # Bottom sheet modal (swipe-down to close)
│   │   ├── ResponsiveModal.tsx    # MobileSheet on mobile, DaisyUI modal on desktop
│   │   ├── FAB.tsx                # Floating Action Button (fixed bottom-right, safe-area aware)
│   │   ├── Skeleton.tsx           # Reusable skeleton loaders
│   │   ├── EmptyState.tsx         # Reusable empty state (icon + title + description + CTA)
│   │   ├── ScrollToTop.tsx        # window.scrollTo(0,0) au changement de pathname
│   │   ├── ConfirmModal.tsx       # Dialogue de confirmation themable (variant danger/warning/neutral)
│   │   ├── NumberStepper.tsx      # +/- numeric input (min/max/step)
│   │   └── ChipAutocompleteInput.tsx # Chips + autocomplete generique (extrait de TagInput) : searchEndpoint/labels parametres, reutilise par TagInput et UtensilListInput (CookV1)
│   ├── notifications/
│   │   ├── NotificationBell.tsx   # Bell icon + badge + dropdown
│   │   └── NotificationItem.tsx   # Single notification item with icon, nav, delete
│   ├── layout/
│   │   ├── Navbar.tsx             # Conditional: MobileHeader+BottomTabBar on mobile, DesktopNavbar on desktop
│   │   ├── AppLayout.tsx          # Main layout wrapper (mobile padding for header/tab bar)
│   │   ├── MobileHeader.tsx       # Fixed top header: logo, ConnectionStatus, NotificationBell
│   │   └── BottomTabBar.tsx       # Fixed bottom navigation: Events, Planning, Games, Profile
│   ├── events/
│   │   ├── CreateEventModal.tsx   # Modal creation event (champ Discord Role ID si admin)
│   │   ├── EditEventModal.tsx     # Modal edition event (+ bouton Purger si admin)
│   │   └── ParticipantList.tsx    # Participant table with remove/leave, filtre par role
│   ├── planning/
│   │   ├── PlanningTab.tsx        # Onglet planning (toggle timeline/calendar, export PDF si admin+toggle)
│   │   ├── CreateTableModal.tsx   # Modal for creating tables
│   │   ├── EditTableModal.tsx     # Modal for editing tables
│   │   ├── TableCard.tsx          # Table summary card
│   │   ├── TableDetailModal.tsx   # Detail table (join/leave, gestion joueurs si GM/admin)
│   │   ├── TagInput.tsx           # Tag autocomplete multi-select (wrapper fin sur common/ChipAutocompleteInput)
│   │   ├── BoardGameSelector.tsx  # Selection jeu pour une table
│   │   ├── TimelineView.tsx       # Chronological table list grouped by date + creneaux cuisine (CookV1 Lot F)
│   │   ├── CalendarView.tsx       # FullCalendar timegrid (drag/resize si GM/admin, multi-day, mobile nav) + creneaux cuisine lecture seule
│   │   ├── CalendarEventBlock.tsx # Custom event block renderer (table ou repas, couleur selon statut/conflit)
│   │   ├── MealSlotCard.tsx       # Carte creneau cuisine (vue liste Planning), surbrillance conflit personne/chef (CookV1 Lot F)
│   │   ├── kitchenSlots.ts        # Type MealSlot partage (donnees GET /kitchen affichees dans le Planning)
│   │   └── computeLayout.ts       # Layout helpers timeline/calendar
│   ├── boardgames/
│       ├── BoardGameTab.tsx           # Onglets All (lecture seule) / My List (avec bouton Remove)
│       ├── BoardGameSearchInput.tsx   # Autocomplete search (local + BGG)
│       ├── BoardGameCard.tsx          # Game card (Remove: proprietaire ou admin)
│       ├── BoardGameDetailModal.tsx   # Detail d'un jeu
│       ├── BoardGameList.tsx          # List grouped by game
│       ├── AddBoardGameModal.tsx      # Modal: search + add or create manually
│       ├── ManualBoardGameForm.tsx    # Manual creation form
│       └── PoweredByBGG.tsx           # Attribution BGG
│   └── kitchen/                       # Module cuisine (CookV1) — onglet "Cuisine" + board dans "Infos" ; refonte UI/UX Gestion+Dashboard (theme "TomUpdate" en reserve, cf styles/index.css)
│       ├── KitchenTab.tsx             # Racine onglet Cuisine (donnees en props via useKitchenData) : titre "Cuisine" serif + ChefRoleSettings (manager) ; selecteur Gestion/Vue d'ensemble (selon role) + Mon repas des que l'utilisateur cumule un role chef — admin+chef cumule desormais acces dashboard ET fiche perso (avant : exclusifs) ; landing auto sur "Mon repas" pour manager+chef ou admin+chef (point 5 etendu)
│       ├── KitchenManagementPanel.tsx # Gestion (responsable RW / admin R) : bloc allergies editable inline (etat vide distinct), etat du planning (badge Publie/Non publie + toggle live + jauge capacite), roster equipe cuisine (avatars, Sans affectation en liste scrollable), + liste des fiches (MealFichesList, manager only) ; reglage chefRoleId deplace dans ChefRoleSettings (plus dans ce panneau)
│       ├── KitchenDashboard.tsx       # Vue d'ensemble admin (lecture seule, meme habillage visuel que Gestion) : tuiles KPI (chefs/courses/sans-affectation), statut de publication en lecture seule, roster en chips avatar, fiches repas en cartes bordure coloree par statut (Evolutions.md point 5, cumulatif avec le role chef desormais)
│       ├── ChefRoleSettings.tsx       # Popover reglage "ID du role Discord des chefs" (gear en en-tete de KitchenTab, manager only), extrait de KitchenManagementPanel
│       ├── PersonAvatar.tsx           # Pastille d'initiales partagee (roster + chef d'une fiche repas)
│       ├── icons.tsx                  # Pictos trait SVG (maquette Cuisine, ecrans Gestion/Dashboard uniquement — le reste de l'appli reste en emoji)
│       ├── ui.tsx                     # CARD (bordure+ombre carte) + SectionEyebrow partages entre KitchenManagementPanel/KitchenDashboard
│       ├── KitchenBoard.tsx           # Board (onglet Infos, donnees en props) : matrice jour x service (desktop table / cartes mobiles), inscription/deplacement/desinscription equipier (jamais propose a un chef/membre courses), banniere "choisis ton creneau", + AssistantSwapPanel si l'equipier a un creneau
│       ├── MealClaimSelect.tsx        # Chef sans repas : liste deroulante des creneaux (groupes par jour, pris grises) -> claim
│       ├── MealSwapPanel.tsx          # Chef avec repas : proposer un echange (repas d'un autre chef) OU prendre un creneau libre instantanement (tag "libre", Evolutions.md point 1) + accepter/refuser/annuler (demandes PENDING)
│       ├── AssistantSwapPanel.tsx     # Equipier avec un creneau complet : propose un echange contre un autre creneau complet (n'importe quel assistant du repas cible peut accepter) + accepter une demande recue + annuler la sienne (Evolutions.md point 4)
│       ├── MealFichesList.tsx         # Liste Gestion (Admin Chef, manager only) : cartes en grille responsive (point 6), bordure coloree par statut (chef a assigner/complet/places libres), une carte par repas (creneau non-editable, chef/capacite/equipiers actionnables inline), clic -> MealFicheDetailModal ; jamais utilise dans "Mon repas"
│       ├── MealFicheDetailModal.tsx   # Modale "details" (Admin Chef, ResponsiveModal) : lecture seule (nom du plat + ingredients + ustensiles) -> "Modifier" -> "Valider" (un seul PATCH groupe, ferme la modale)
│       ├── MealFicheEditor.tsx        # Fiche "Mon repas" (chef, inchangee) : autosave par champ (useDebouncedSave, pas de bouton) nom/ingredients/ustensiles, resume horaires/capacite en lecture seule, suppression
│       ├── IngredientListInput.tsx    # Lignes ingredient (nom + quantite + unite), autocomplete Product, quantite virgule/point (point 8)
│       ├── UtensilListInput.tsx       # Chips + autocomplete Utensil (wrapper sur common/ChipAutocompleteInput, point 7)
│       └── units.ts                   # UNIT_OPTIONS/SERVICE_OPTIONS + labels francais + dayLabel/slotLabel (heure de Paris via utils/dateTime.ts)
├── hooks/
│   ├── useSocket.ts             # Socket.io singleton connection
│   ├── useEventSocket.ts        # Join/leave event room, listen to events (dont kitchen:* + kitchen:assistant-swap-changed, CookV1)
│   ├── useNotifications.ts      # Notification fetch, socket, mark read, pagination
│   ├── useIsMobile.ts           # matchMedia hook for mobile breakpoint detection
│   ├── useOnlineStatus.ts       # Browser online/offline detection hook
│   ├── useTheme.ts              # Dark/light mode, localStorage, data-theme sur <html>
│   ├── useModalA11y.ts          # A11y modales : Echap, focus trap, auto-focus, restore focus (pile de modales)
│   ├── usePageTitle.ts          # document.title par page ("<titre> - TomManager")
│   ├── useAdminRights.ts        # Droits admin opt-in derives des preferences (canManageEvents, canModerateTables, canModerateGames, isKitchenManager, pdfExportEnabled, gameDbEnabled)
│   ├── useKitchenData.ts        # GET /kitchen + /kitchen/swaps + /kitchen/assistant-swaps + wiring socket kitchen:*, partage entre EventDetailPage (visibilite onglet) / KitchenBoard / KitchenTab (evite les doubles fetch, CookV1)
│   └── useDebouncedSave.ts      # Sauvegarde a la volee generique (debounce + statut idle/saving/saved/error), utilise par MealFicheEditor (CookV1)
├── utils/
│   └── dateTime.ts              # formatParisDate/Time/DateTime + parisDayKey (affichage) + parisDateInputValue/parisTimeInputValue/parisDateTimeInputValue/dateTimeLocalToParisUtcIso/dateAndTimeToParisUtcIso (inputs) + toParisFakeUtc/fromParisFakeUtc/parisFakeUtcNow/formatFakeUtcDate (fake-UTC FullCalendar) — toute l'app raisonne en heure de Paris (ParisTimezone)
├── contexts/
│   ├── AuthContext.tsx     # AuthProvider, useAuth hook (login, logout, Discord link/unlink, preferences + updatePreferences optimiste)
│   ├── ConfirmContext.tsx  # ConfirmProvider + useConfirm : confirmDialog(options) -> Promise<boolean>
│   └── ThemeContext.tsx    # ThemeProvider, useTheme hook — DARK_THEME pointe "ToM" (theme "TomUpdate" compile en reserve dans styles/index.css, non actif)
├── types/
│   └── preferences.ts      # PreferenceKey, Preferences, DEFAULT_PREFERENCES
├── pages/
│   ├── HomePage.tsx              # Landing page
│   ├── LoginPage.tsx             # Login form (identifier + password, bouton Discord)
│   ├── OAuthPopupCallbackPage.tsx # Callback popup OAuth Discord
│   ├── EventListPage.tsx         # /events — event cards grid (bouton creer si admin)
│   ├── EventDetailPage.tsx       # /events/:eventId — tabs info(+KitchenBoard)/planning/games/participants/kitchen (soulignement, pas tabs-boxed) ; useKitchenData partage, onglet Cuisine masque si ni admin ni chef ni manager ; page plafonnee a 1400px au-dela de 2xl (evite l'etirement plein-largeur sur grand ecran)
│   ├── PlanningPage.tsx          # /events/:eventId/planning — timeline view + create table
│   ├── ProfilePage.tsx           # /profile — compte, theme, droits d'administration (toggles + master), Discord
│   └── NotFoundPage.tsx          # 404
├── routes/
│   └── AppRoutes.tsx      # Route definitions
├── styles/
│   └── index.css          # Tailwind directives + 2 themes DaisyUI custom : "ToM" (dark, actif) et "TomUpdate" (palette maquette Cuisine, compile mais non actif — cf ThemeContext.tsx)
├── test/
│   └── setup.ts           # jest-dom setup (@testing-library/jest-dom)
└── __tests__/             # Tests composants (BoardGameCard, NotificationBell, LoginPage, ...)
```
