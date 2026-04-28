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

- JWT authentication and user isolation
- Asset CRUD for stocks, REITs, crypto, fixed income, and cash positions
- Portfolio summary and allocation overview endpoints
- Market refresh flows with cache TTL controls
- Exchange rate caching and market index historical caching
- Profile picture upload integrated with Supabase Storage
- Rate limiting on heavy endpoints and login protection

## Tech stack

- Node.js + Express + TypeScript
- PostgreSQL + TypeORM
- Zod for input validation
- Yahoo Finance integration for market prices
- Supabase Storage for media assets
- Railway deployment for API and database

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

1. Implement user roles with a manager profile.
2. Allow manager users to update target allocation percentages.
3. Allow manager users to view the portfolios of up to 10-20 users.
4. Add role-based authorization guards and audit logs for manager actions.
5. Implement automated tests.
