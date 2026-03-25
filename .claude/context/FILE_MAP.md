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
│   └── tag.ts             # tag autocomplete search
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
│   └── tag.ts             # Tag routes (autocomplete)
├── services/
│   ├── auth.ts            # Auth business logic
│   ├── event.ts           # Event CRUD + cascade to GameTables
│   ├── gameTable.ts       # GameTable CRUD, join/leave/kick, waitlist
│   ├── invitation.ts      # Invitation CRUD, token validation
│   ├── participant.ts     # Participant management + cascade to GameTables
│   └── tag.ts             # Tag find-or-create, search
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
        └── participant.test.ts # Participant + invitation listing tests
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
│   ├── layout/
│   │   └── Navbar.tsx             # Top navigation bar
│   ├── events/
│   │   ├── CreateEventModal.tsx   # Modal for creating events
│   │   ├── EditEventModal.tsx     # Modal for editing events
│   │   ├── ParticipantList.tsx    # Participant table with remove/leave
│   │   └── InvitationManager.tsx  # Send + list invitations
│   └── planning/
│       ├── CreateTableModal.tsx   # Modal for creating tables
│       ├── EditTableModal.tsx     # Modal for editing tables
│       ├── TableCard.tsx          # Table summary card
│       ├── TagInput.tsx           # Tag autocomplete multi-select
│       └── TimelineView.tsx       # Chronological table list grouped by date
├── contexts/
│   └── AuthContext.tsx     # AuthProvider, useAuth hook
├── pages/
│   ├── HomePage.tsx              # Landing page
│   ├── LoginPage.tsx             # Login form (identifier, optional token)
│   ├── SignupPage.tsx            # Signup form (invitation required)
│   ├── InvitationLandingPage.tsx # /invite/:token — validates and redirects
│   ├── EventListPage.tsx         # /events — event cards grid
│   ├── EventDetailPage.tsx       # /events/:eventId — tabs info/participants/invitations/planning
│   ├── PlanningPage.tsx          # /events/:eventId/planning — timeline view + create table
│   └── TableDetailPage.tsx      # /events/:eventId/planning/:tableId — detail + join/leave/kick
├── routes/
│   └── AppRoutes.tsx      # Route definitions
├── styles/
│   └── index.css          # Tailwind directives
└── __tests__/
    ├── setup/
    │   └── vitestSetup.ts # jest-dom setup
    └── unit/
        └── App.test.tsx   # App render test
```
