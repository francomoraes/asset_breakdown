# Asset Breakdown API

Backend service for portfolio tracking, allocation analysis, and market data refresh.

## Live URLs

- API base URL: https://assetbreakdown-production.up.railway.app/api
- Health endpoint: https://assetbreakdown-production.up.railway.app/health
- Frontend app: https://investment-tracker-manager.vercel.app/

## Demo account

- Email: user@test.com
- Password: User123!

This account is intended for public demo usage only.

## What this API covers

- JWT authentication (register, login, token validation) with bcrypt password hashing
- User-scoped data isolation — every query is filtered by authenticated user
- Asset CRUD for variable assets (stocks, REITs, ETFs, crypto) and fixed income instruments
- Institution and asset class/type management with reference data endpoints
- Portfolio summary with allocation breakdown by asset class and currency
- Market price refresh via Yahoo Finance 2 with concurrency control and per-asset-type caching
- Exchange rate caching (TTL-based) for multi-currency portfolio valuation
- Brazilian Central Bank (BCB) integration for historical financial index data (CDI, SELIC, IPCA, etc.)
- Market indices tracking and historical series caching
- Fixed income yield calculation using BCB index rates
- Automated monthly wealth snapshot job (cron-ready)
- Wealth history endpoints with paginated responses
- Bulk asset import via CSV upload and parsing
- Profile picture upload via Multer, stored in Supabase Storage
- Multi-tier rate limiting (global limiter + strict limiter on sensitive endpoints)
- Demo mode middleware that blocks destructive operations in the public demo environment
- Centralized error handling with custom error classes (NotFoundError, ConflictError, BadRequestError)
- Structured request logging via Winston

## Tech stack

- Node.js + Express 5 + TypeScript
- PostgreSQL + TypeORM
- Zod for input validation and DTO schemas
- bcrypt for password hashing, JWT for session tokens
- Yahoo Finance 2 for live market prices
- BCB (Brazilian Central Bank) API for financial index series
- Supabase Storage for media assets
- Multer for file upload handling
- Winston for structured logging
- Helmet + CORS + express-rate-limit for security hardening
- Vitest for unit tests with V8 coverage
- Newman for API integration tests (Postman collections versioned in the repo)
- Railway for API and database deployment

## Key endpoints

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/upload-profile-picture
- GET /api/assets
- POST /api/assets/refresh-market-prices
- GET /api/summary
- GET /api/summary/overview
- GET /api/wealth-history/market-indices

## Local development

```bash
npm install
npm run dev
```

## Build and start

```bash
npm run build
npm start
```

## Next steps (portfolio roadmap)

The next major feature is a full manager–investor relationship system. Key planned work:

1. **User roles** — introduce `investor`, `manager`, and `admin` roles; admin assigns manager role manually.
2. **Link management** — investors request a link to a manager; manager accepts or rejects; links can be revoked by either party or by a system rule.
3. **Manager read access** — managers can view the full portfolio of each linked investor (read-only), with the exception of editing asset type target allocation percentages.
4. **Manager dashboard** — consolidated view with portfolio metrics across all active clients.
5. **Link history** — preserve full history of past manager–investor relationships including dates and initial/final wealth per cycle.
6. **Role-based authorization guards** — protect all new endpoints with role checks.
7. **Soft delete** — LGPD-compliant user deletion flow.
8. **Expanded seed** — seed data covering all roles and populated wealth/history records for every profile.
