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

The manager–investor relationship system (RBAC) described in earlier roadmaps has been fully implemented — roles, bidirectional link requests/approval, manager read access via `resolveEffectiveUserId`, manager dashboard, link history, role guards, and an expanded seed covering all roles. See `docs/done/rbac-feature.md` and `docs/done/bugs-16-07-fixes.md`.

Remaining work:

1. **Crypto tracking & price refresh** — connect Ethereum wallets and Mercado Bitcoin accounts, auto-sync balances as assets. Not started — see `docs/crypto-tracking-price-refresh.md`.
2. **CI/CD automation** — GitHub Actions pipelines for lint/test/build and auto-deploy on push. Rate limiting, caching, and manual deploy are already done — see `docs/done/plano-objetivo-deploy-cicd.md` — only the automation step remains.
3. **Soft delete** — LGPD-compliant user deletion flow.
4. **Item 7 investigation** — intermittent missing goals/positions in the manager's view of a client's portfolio, only in production; root cause still unknown (schema/migration already ruled out). See `docs/done/bugs-16-07-fixes.md`, section 10.
5. **Security follow-ups** — a few audit items still require manual verification: cross-user IDOR test, login timing attack, distributed brute-force lockout, `npm audit`, and audit logging for sensitive operations. See `docs/done/security-owasp-design.md`.
