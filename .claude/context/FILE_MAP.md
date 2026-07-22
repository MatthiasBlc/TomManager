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
│   ├── kitchen.ts         # module cuisine (CookV1) : GET config, PATCH config, chefs, courses, generate
│   ├── meal.ts            # CRUD repas (creation = creneau orphelin jour+service) + claim + inscriptions equipier (CookV1)
│   ├── mealSwap.ts        # echange de creneau chefs : create/list/accept/reject/cancel (CookV1)
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
│   ├── kitchen.ts         # Kitchen + meal routes (config, chefs, courses, meals CRUD, assistants)
│   ├── product.ts         # GET /api/kitchen/products (autocomplete)
│   ├── utensil.ts         # GET /api/kitchen/utensils (autocomplete, CookV1)
│   └── test.ts            # Seed E2E (seed-admin, seed-participant) — test/dev only
├── schemas/
│   ├── auth.ts            # loginSchema (zod)
│   ├── event.ts           # create/update event schemas
│   ├── gameTable.ts       # create/update table + status schemas
│   ├── preference.ts      # PREFERENCE_KEYS (liste blanche) + updatePreferencesSchema
│   ├── boardGame.ts       # boardgame schemas + updateBoardGameAdminSchema + mergeSchema
│   └── kitchen.ts         # config, chef/courses member, create/update meal, createSwapRequestSchema (ingredients/utensils)
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
│   ├── kitchen.ts         # Config + roster chef (manuel/role) + courses + vue par role, meals enrichis conflits (CookV1)
│   ├── meal.ts            # Meal CRUD (creation manuelle = creneau orphelin, buildManualSlot), claimMeal, join/move/leave transactionnel ; champs structurants manager-only (CookV1)
│   ├── mealSwap.ts        # Echange de creneau entre chefs : create/list/accept/reject/cancel, transaction de swap recette (CookV1)
│   ├── product.ts         # Product find-or-create + search, pattern Tag (CookV1)
│   ├── utensil.ts         # Utensil find-or-create + search, pattern Product/Tag (CookV1, Evolutions.md point 7)
│   ├── kitchenPlanning.ts # Generation planning : computeExpectedSlots (grille Paris) + computeMealCapacities + generatePlanning idempotent + buildManualSlot/slotKey (reutilises par meal.ts createMeal) (CookV1)
│   └── conflicts.ts       # Moteur de conflits UNIFIE tables+cuisine : getEventOccupations + computeConflicts (CookV1 Lot F), partage par gameTable.ts et kitchen.ts
├── socket/
│   ├── index.ts           # Socket.io setup, session auth, room handlers (event + user rooms), getIO()
│   └── emitter.ts         # emitToEvent, emitToUser helpers for services
├── types/
│   └── express-session.d.ts  # Session type augmentation
├── util/
│   ├── db.ts              # PrismaClient singleton
│   ├── logger.ts          # Pino logger
│   └── sentry.ts          # Sentry init
└── __tests__/
    ├── setup/             # globalSetup (DB cleanup), testHelpers (supertest)
    └── integration/
        ├── health.test.ts, auth.test.ts, discordAuth.test.ts
        ├── event.test.ts, gameTable.test.ts, participant.test.ts
        ├── boardGame.test.ts, eventBoardGame.test.ts, adminBoardGame.test.ts
        ├── socket.test.ts, notification.test.ts, validation.test.ts, preference.test.ts
        ├── kitchen.test.ts, meal.test.ts (create manager-only + claim), mealSwap.test.ts, kitchenPlanning.test.ts (grille + idempotence)
        └── kitchenConflicts.test.ts (conflits cross-domaine tables<->cuisine), kitchenPurge.test.ts (purge etendue, sync ROLE mockee)
```

Unitaires purs (`src/__tests__/unit/`) : `kitchenPlanning.test.ts` (computeMealCapacities + computeExpectedSlots), `conflicts.test.ts` (computeConflicts).

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
│   ├── syncKitchenChef.ts          # handleChefRoleAdded/Removed (roster KitchenChef ROLE, CookV1)
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
│   └── kitchen/                       # Module cuisine (CookV1) — onglet "Cuisine" + board dans "Infos"
│       ├── KitchenTab.tsx             # Racine onglet Cuisine (donnees en props via useKitchenData) : redirige chef+manager sur "Mon repas" ; "Mon repas" = allergies + (claim ou MealFicheEditor de sa seule fiche) + swap, jamais la liste complete (point 6)
│       ├── KitchenManagementPanel.tsx # Gestion (responsable RW / admin R) : config, roster, courses, generate (grille), creation manuelle (CreateMealSlotModal), reassignation, + liste complete des fiches (MealFichesList, manager only)
│       ├── KitchenBoard.tsx           # Board (onglet Infos, donnees en props) : matrice jour x service (desktop table / cartes mobiles), inscription/deplacement/desinscription equipier (jamais propose a un chef/membre courses), banniere "choisis ton creneau"
│       ├── MealClaimSelect.tsx        # Chef sans repas : liste deroulante des creneaux (groupes par jour, pris grises) -> claim
│       ├── MealSwapPanel.tsx          # Chef avec repas : proposer un echange + accepter/refuser/annuler (demandes PENDING)
│       ├── MealFichesList.tsx         # Wrapper Gestion-only : une MealFicheEditor (canEditSchedule) par repas, jamais utilise dans "Mon repas"
│       ├── MealFicheEditor.tsx        # Fiche editable inline, autosave par champ (useDebouncedSave, pas de bouton) : nom/ingredients/ustensiles (chef+manager), service/horaires/capacite (manager only), suppression
│       ├── CreateMealSlotModal.tsx    # Creation manuelle hors-grille (manager, mini-modale jour+service) : cree un creneau orphelin, nom/horaires derives backend
│       ├── IngredientListInput.tsx    # Lignes ingredient (nom + quantite + unite), autocomplete Product, quantite virgule/point (point 8)
│       ├── UtensilListInput.tsx       # Chips + autocomplete Utensil (wrapper sur common/ChipAutocompleteInput, point 7)
│       └── units.ts                   # UNIT_OPTIONS/SERVICE_OPTIONS + labels francais + dayLabel
├── hooks/
│   ├── useSocket.ts             # Socket.io singleton connection
│   ├── useEventSocket.ts        # Join/leave event room, listen to events (dont kitchen:*, CookV1)
│   ├── useNotifications.ts      # Notification fetch, socket, mark read, pagination
│   ├── useIsMobile.ts           # matchMedia hook for mobile breakpoint detection
│   ├── useOnlineStatus.ts       # Browser online/offline detection hook
│   ├── useTheme.ts              # Dark/light mode, localStorage, data-theme sur <html>
│   ├── useModalA11y.ts          # A11y modales : Echap, focus trap, auto-focus, restore focus (pile de modales)
│   ├── usePageTitle.ts          # document.title par page ("<titre> - TomManager")
│   ├── useAdminRights.ts        # Droits admin opt-in derives des preferences (canManageEvents, canModerateTables, canModerateGames, isKitchenManager, pdfExportEnabled, gameDbEnabled)
│   ├── useKitchenData.ts        # GET /kitchen + /kitchen/swaps + wiring socket kitchen:*, partage entre EventDetailPage (visibilite onglet) / KitchenBoard / KitchenTab (evite les doubles fetch, CookV1)
│   └── useDebouncedSave.ts      # Sauvegarde a la volee generique (debounce + statut idle/saving/saved/error), utilise par MealFicheEditor (CookV1)
├── contexts/
│   ├── AuthContext.tsx     # AuthProvider, useAuth hook (login, logout, Discord link/unlink, preferences + updatePreferences optimiste)
│   ├── ConfirmContext.tsx  # ConfirmProvider + useConfirm : confirmDialog(options) -> Promise<boolean>
│   └── ThemeContext.tsx    # ThemeProvider, useTheme hook
├── types/
│   └── preferences.ts      # PreferenceKey, Preferences, DEFAULT_PREFERENCES
├── pages/
│   ├── HomePage.tsx              # Landing page
│   ├── LoginPage.tsx             # Login form (identifier + password, bouton Discord)
│   ├── OAuthPopupCallbackPage.tsx # Callback popup OAuth Discord
│   ├── EventListPage.tsx         # /events — event cards grid (bouton creer si admin)
│   ├── EventDetailPage.tsx       # /events/:eventId — tabs info(+KitchenBoard)/planning/games/participants/kitchen ; useKitchenData partage, onglet Cuisine masque si ni admin ni chef ni manager
│   ├── PlanningPage.tsx          # /events/:eventId/planning — timeline view + create table
│   ├── ProfilePage.tsx           # /profile — compte, theme, droits d'administration (toggles + master), Discord
│   └── NotFoundPage.tsx          # 404
├── routes/
│   └── AppRoutes.tsx      # Route definitions
├── styles/
│   └── index.css          # Tailwind directives
├── test/
│   └── setup.ts           # jest-dom setup (@testing-library/jest-dom)
└── __tests__/             # Tests composants (BoardGameCard, NotificationBell, LoginPage, ...)
```
