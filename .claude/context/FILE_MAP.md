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
│   ├── event.ts           # create event
│   └── invitation.ts      # create invitation, validate token
├── middleware/
│   ├── auth.ts            # requireAuth, requireAdmin
│   └── errorHandler.ts    # Global error handler
├── routes/
│   ├── index.ts           # Main router
│   ├── auth.ts            # Auth routes
│   ├── event.ts           # Event routes
│   └── invitation.ts      # Invitation routes
├── services/
│   ├── auth.ts            # Auth business logic
│   ├── event.ts           # Event creation
│   └── invitation.ts      # Invitation CRUD, token validation
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
        ├── health.test.ts     # Health check test
        ├── auth.test.ts       # Auth API tests
        ├── event.test.ts      # Event API tests
        └── invitation.test.ts # Invitation API tests
```

## Frontend (frontend/src/)

```
src/
├── main.tsx               # Entry point
├── App.tsx                # Router + Toaster
├── vite-env.d.ts          # Vite types
├── config/
│   └── api.ts             # Axios instance
├── pages/
│   ├── HomePage.tsx       # Landing page
│   └── LoginPage.tsx      # Login form
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
