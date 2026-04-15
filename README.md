# Game Collector

> **Showcase project** — built to demonstrate a full-stack TypeScript architecture. Not intended for production use.

A board game collection manager where users can track games they own, want, or are willing to trade. It integrates with the [BoardGameGeek](https://boardgamegeek.com/) API for game metadata and includes a small accessories marketplace backed by the Shopify Storefront API.

## Live demo is deployed to Render and can be accessed [here](https://game-collector-client.onrender.com/)

## Features

- **Collection management** — add games to your library with statuses: _In Collection_, _Wishlist_, or _For Trade_
- **Trades** — browse others' listings, send trade requests, accept or decline; real-time activity feed via WebSockets
- **Market** — browse premium accessories sourced from Shopify (falls back to mock data if not configured)
- **Auth** — JWT access + refresh tokens; refresh tokens stored in Redis for revocation support
- **BGG search** — game search and metadata pulled from the BoardGameGeek XML API with Redis caching

---

## Tech Stack

| Layer            | Technology                                                                 |
| ---------------- | -------------------------------------------------------------------------- |
| Frontend         | React 18, TypeScript, Vite, React Router 7, Tailwind CSS, Socket.IO client |
| Backend          | NestJS 10, TypeScript, TypeORM, Socket.IO (WebSockets)                     |
| Database         | PostgreSQL 16                                                              |
| Cache / sessions | Redis 7                                                                    |
| Auth             | JWT (access + refresh), Passport, bcrypt                                   |
| External APIs    | BoardGameGeek XML API, Shopify Storefront GraphQL API                      |
| Dev tooling      | Docker Compose, Prettier, ESLint, Swagger (`/api/docs`)                    |

---

## Running Locally

### Prerequisites

- Node.js 20+
- Docker and Docker Compose

### 1. Start infrastructure

```bash
npm run docker:up
```

This starts **PostgreSQL** (port 5432) and **Redis** (port 6379).

### 2. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` with your values. At minimum the defaults work for local development — the only optional credentials are `BGG_TOKEN` (for BoardGameGeek) and the Shopify keys (the market falls back to mock data without them).

### 3. Install dependencies

```bash
npm install
```

### 4. Run the app

In separate terminals:

```bash
npm run dev:backend    # NestJS on http://localhost:3000
npm run dev:frontend   # Vite on http://localhost:5173
```

The frontend proxies all `/api` requests to the backend in development, so no additional CORS configuration is needed.

**API docs (Swagger):** http://localhost:3000/api/docs

---

## Architecture

```
game-collector/
├── backend/          # NestJS REST + WebSocket API
│   └── src/
│       ├── auth/     # JWT auth, refresh token flow
│       ├── users/    # User entity and profile endpoint
│       ├── games/    # Collection management + BGG integration
│       ├── trades/   # Trade CRUD + Socket.IO gateway
│       ├── market/   # Shopify Storefront GraphQL client
│       └── redis/    # Shared Redis module
└── frontend/         # React SPA
    └── src/
        ├── pages/    # CollectionPage, TradesPage, MarketPage, auth pages
        ├── components/
        ├── api/      # Typed fetch clients (with auto token refresh)
        ├── contexts/ # AuthContext
        └── hooks/    # useAuth, useSocket
```

### Key design decisions

- **Monorepo with npm workspaces** — backend and frontend share a single `package-lock.json`; Docker Compose only manages infrastructure (no app containers)
- **Redis dual-purpose** — used for refresh token storage (auth) and response caching (BGG search: 1 hour, Shopify products: 5 minutes)
- **Real-time trades** — a dedicated Socket.IO namespace (`/trades`) broadcasts `trade-activity` events and supports per-trade rooms for targeted updates
- **BGG integration** — the BoardGameGeek API returns XML; the backend parses it with `xml2js` and caches results to avoid hammering the public API
- **Market fallback** — if Shopify credentials are absent or the request fails, the backend returns a static mock product catalog so the UI is always functional
