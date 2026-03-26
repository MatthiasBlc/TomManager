# File Map - Arborescence source

## Backend (backend/src/)

```
src/
├── server.ts              # Entry point, HTTP server
├── app.ts                 # Express app, middleware, routes
├── config/
│   └── env.ts             # Environment validation (envalid)
├── controllers/
│   ├── auth.ts            # signup, login, logout, me
│   ├── event.ts           # CRUD event (create, list, detail, update, delete)
│   ├── gameTable.ts       # CRUD table + join/leave/kick
│   ├── invitation.ts      # create, validate, list invitations
│   ├── participant.ts     # list, remove, leave participants
│   ├── tag.ts             # tag autocomplete search
│   ├── boardGame.ts       # search, detail, create, findOrCreateBGG
│   ├── eventBoardGame.ts  # add, list, remove event board games
│   └── notification.ts    # list, unreadCount, markAsRead, markAllAsRead, delete
├── middleware/
│   ├── auth.ts            # requireAuth, requireAdmin, requireEventParticipant, requireEventCreator, requireTableGMOrAdmin
│   └── errorHandler.ts    # Global error handler
├── routes/
│   ├── index.ts           # Main router
│   ├── auth.ts            # Auth routes
│   ├── event.ts           # Event routes (CRUD)
│   ├── gameTable.ts       # GameTable routes (CRUD + join/leave/kick)
│   ├── invitation.ts      # Invitation routes (create, list, validate)
│   ├── participant.ts     # Participant routes (list, remove, leave)
│   ├── tag.ts             # Tag routes (autocomplete)
│   ├── boardGame.ts       # BoardGame routes (search, detail, create, from-bgg)
│   ├── eventBoardGame.ts  # EventBoardGame routes (add, list, remove)
│   └── notification.ts    # Notification routes (list, count, read, readAll, delete)
├── services/
│   ├── auth.ts            # Auth business logic
│   ├── event.ts           # Event CRUD + cascade to GameTables
│   ├── gameTable.ts       # GameTable CRUD, join/leave/kick, waitlist
│   ├── invitation.ts      # Invitation CRUD, token validation
│   ├── participant.ts     # Participant management + cascade to GameTables
│   ├── tag.ts             # Tag find-or-create, search
│   ├── bgg.ts             # BGG XML API client (search, thing detail)
│   ├── boardGame.ts       # BoardGame CRUD, search (local + BGG fallback)
│   ├── eventBoardGame.ts  # EventBoardGame CRUD (add/list/remove per event)
│   └── notification.ts    # Notification CRUD, bulk create, cursor pagination
├── socket/
│   ├── index.ts           # Socket.io setup, session auth, room handlers (event + user rooms), getIO()
│   └── emitter.ts         # emitToEvent, emitToUser helpers for services
├── types/
│   └── express-session.d.ts  # Session type augmentation
├── util/
│   ├── db.ts              # PrismaClient singleton
│   └── logger.ts          # Pino logger
└── __tests__/
    ├── setup/
    │   ├── globalSetup.ts # DB cleanup afterEach
    │   └── testHelpers.ts # Supertest helpers
    └── integration/
        ├── health.test.ts      # Health check test
        ├── auth.test.ts        # Auth API tests
        ├── event.test.ts       # Event CRUD tests
        ├── gameTable.test.ts   # GameTable CRUD + join/leave/kick + cascade tests
        ├── invitation.test.ts  # Invitation API tests
        ├── participant.test.ts # Participant + invitation listing tests
        ├── boardGame.test.ts      # BoardGame CRUD + BGG search tests
        ├── eventBoardGame.test.ts # EventBoardGame CRUD + cascade tests
        ├── socket.test.ts         # Socket.io auth, rooms, broadcast tests
        └── notification.test.ts   # Notification service + API + trigger tests
```

## Frontend (frontend/src/)

```
src/
├── main.tsx               # Entry point
├── App.tsx                # Router + AuthProvider + Toaster
├── vite-env.d.ts          # Vite types
├── config/
│   └── api.ts             # Axios instance
├── components/
│   ├── common/
│   │   ├── ConnectionStatus.tsx   # WebSocket connection indicator
│   │   ├── MobileSheet.tsx        # Bottom sheet modal (swipe-down to close)
│   │   ├── ResponsiveModal.tsx    # MobileSheet on mobile, DaisyUI modal on desktop
│   │   └── FAB.tsx                # Floating Action Button (fixed bottom-right)
│   ├── notifications/
│   │   ├── NotificationBell.tsx   # Bell icon + badge + dropdown
│   │   └── NotificationItem.tsx   # Single notification item with icon, nav, delete
│   ├── layout/
│   │   ├── Navbar.tsx             # Conditional: MobileHeader+BottomTabBar on mobile, DesktopNavbar on desktop
│   │   ├── AppLayout.tsx          # Main layout wrapper (mobile padding for header/tab bar)
│   │   ├── MobileHeader.tsx       # Fixed top header: logo, ConnectionStatus, NotificationBell
│   │   └── BottomTabBar.tsx       # Fixed bottom navigation: Events, Planning, Games, Profile
│   ├── events/
│   │   ├── CreateEventModal.tsx   # Modal for creating events
│   │   ├── EditEventModal.tsx     # Modal for editing events
│   │   ├── ParticipantList.tsx    # Participant table with remove/leave
│   │   └── InvitationManager.tsx  # Send + list invitations
│   ├── planning/
│   │   ├── CreateTableModal.tsx   # Modal for creating tables
│   │   ├── EditTableModal.tsx     # Modal for editing tables
│   │   ├── TableCard.tsx          # Table summary card
│   │   ├── TagInput.tsx           # Tag autocomplete multi-select
│   │   └── TimelineView.tsx       # Chronological table list grouped by date
│   └── boardgames/
│       ├── BoardGameTab.tsx           # Tab integrating list + add button
│       ├── BoardGameSearchInput.tsx   # Autocomplete search (local + BGG)
│       ├── BoardGameCard.tsx          # Game card (image, name, players, who brings it)
│       ├── BoardGameList.tsx          # List grouped by game
│       ├── AddBoardGameModal.tsx      # Modal: search + add or create manually
│       └── ManualBoardGameForm.tsx    # Manual creation form
├── hooks/
│   ├── useSocket.ts         # Socket.io singleton connection
│   ├── useEventSocket.ts    # Join/leave event room, listen to events
│   ├── useNotifications.ts  # Notification fetch, socket, mark read, pagination
│   └── useIsMobile.ts       # matchMedia hook for mobile breakpoint detection
├── contexts/
│   └── AuthContext.tsx     # AuthProvider, useAuth hook
├── pages/
│   ├── HomePage.tsx              # Landing page
│   ├── LoginPage.tsx             # Login form (identifier, optional token)
│   ├── SignupPage.tsx            # Signup form (invitation required)
│   ├── InvitationLandingPage.tsx # /invite/:token — validates and redirects
│   ├── EventListPage.tsx         # /events — event cards grid
│   ├── EventDetailPage.tsx       # /events/:eventId — tabs info/planning/games/participants/invitations
│   ├── PlanningPage.tsx          # /events/:eventId/planning — timeline view + create table
│   └── TableDetailPage.tsx      # /events/:eventId/planning/:tableId — detail + join/leave/kick
├── routes/
│   └── AppRoutes.tsx      # Route definitions
├── styles/
│   └── index.css          # Tailwind directives
└── __tests__/
    ├── setup/
    │   └── vitestSetup.ts # jest-dom + matchMedia mock setup
    └── unit/
        ├── App.test.tsx              # App render test
        ├── NotificationBell.test.tsx # NotificationBell component tests
        ├── NotificationItem.test.tsx # NotificationItem component tests
        ├── BottomTabBar.test.tsx     # BottomTabBar navigation tests
        ├── MobileSheet.test.tsx      # MobileSheet bottom sheet tests
        ├── AuthPages.test.tsx       # Auth pages mobile-first tests
        └── EventPages.test.tsx      # FAB + ResponsiveModal tests
```
