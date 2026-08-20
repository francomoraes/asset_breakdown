# Invest tracker (Manager personal investments)

A web application to manage assets, both fixed and variable income.

## The issue

Maintaining a spreadsheet with several tabs, one for asset positions, one for summary, one for the dropdowns options, and manually doing the calculations with formulas can be overwhelming, and often lead to errors. And the solutions is: let's create a web application that does the heavy lifting.

## Central decisions

We created a platform where users can register, import their assets form a CSV file, or include them manually. From this point, the api fetches the market prices, calculates the summary e wealth evolution (monthly).

The app is based on the asset allocation method, where the user (or it's manager) set's a target for the portfolio share of each asset type, and when inserting an asset, it has to be linked to one of the defined asset types.

## Result

I've been using the app myself for a couple of months, and realized it's quite easier than the spreadsheet. It has pretty much every important feature from the spreadsheet, filtering, sorting, creating and updating assets, and still allows some level of customization.

---

<!-- ### Architecture -->

## Tech decisions

### 1. Express

- **Issue**: API for sensible finance data (auth, RBAC, csv upload), need for fast debugging and predictability;
- **Decision**: Express over fastify/nest;
- **Result**: mature middlewares ecosystem, long production history;

### 2. Postgres + TypeORM

- **Issue**: relational data with complex relations;
- **Decision**: Postgres + TypeORM over Postgres + Drizzle/Prisma;
- **Result**: decorated entities as single source of truth for the domain, migrations generated straight from the model, repository pattern maps directly to existing layered architecture (controller → service → repository);

### 3. Authentication: short-lived JWT + silent refresh

**Issue:** Handling sensitive financial data means session security matters,
but forcing users to re-login every few minutes is a bad experience. The
frontend also needed to recover from an expired token transparently, without
the user noticing, and without leaving the access token exposed to XSS.

**Decision:** Access tokens are short-lived (15 min) and kept in memory only
— never written to localStorage or any persistent storage. The refresh token
(7 days) is set as an httpOnly cookie, so it's never reachable from frontend
JavaScript at all. Only non-sensitive user data (id, name, email, role,
locale) is persisted to localStorage, purely to render the UI instantly on
page reload before the session is restored.

**Login flow:**

- `LoginForm` calls `useLoginForm`, which calls `AuthContext.login`, which calls `authService.login` — a POST to `/auth/login` with email and password.
- On the backend, `auth.routes` applies a rate limiter before reaching `auth.controller.login`, which validates the request body with Zod and delegates to `authService.login`.
- `authService.login` checks the user exists and the password hash matches, then issues a 15-minute access token and a 7-day refresh token.
- `auth.controller` sets the refresh token as an httpOnly cookie and returns the access token and user data to the frontend.
- The frontend keeps the access token in memory (`AuthContext` state plus a standalone `tokenStore` module used by the HTTP client) and persists only the non-sensitive user fields to localStorage.

**Silent refresh and concurrency handling:**

- On mount, `AuthContext` calls `tryRefreshToken`, which hits `/auth/refresh` using a dedicated axios instance — separate from the main client, so it never triggers the 401 interceptor recursively.
- A response interceptor on the main client also listens for any 401 from an authenticated request. If a refresh is already in flight, subsequent requests are queued instead of firing their own refresh call, and released once the new token arrives — avoiding a burst of parallel refresh requests when several API calls fail at once.
- On refresh failure, the queue is rejected and `tokenStore.triggerLogout()` fires, clearing local state.
- One race condition is handled explicitly: if a refresh triggered on mount resolves _after_ a user has already logged in successfully, it's discarded instead of overwriting the freshly-set token and user data.

**Result:** Sessions persist across reloads without manual re-login, the access token never touches persistent storage, and concurrent request failures during a token refresh are queued and retried rather than triggering redundant refresh calls or premature logouts.
