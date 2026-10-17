# UMS frontend

One React + TypeScript application with two protected workspaces: `/admin` and `/account`. It implements the current Spring API contracts described in `frontend-technical-requirements-v2.md`, checked against the local backend source on 17 October 2026.

This is the first implemented frontend, ready for local integration. It is not a production release. The Spring service was unavailable during this build, and real cookie/CORS, OAuth, mail and Cloudinary integration still need testing.

## Start locally

Use Node **24.19.0** (pinned in `.nvmrc`) and npm. From this project directory:

```sh
nvm install
nvm use
npm ci
npm run dev
```

If you do not use nvm, install Node 24.19.0 using your normal Node version manager. The local dev server uses **http://localhost:5173** and fails if that port is busy. The development API defaults to **http://localhost:8080**; `.env.local` is optional. To override it, copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to an origin without `/api`.

Start your existing Spring service, PostgreSQL and Redis using the backend's README. Its current default startup configuration also expects the configured mail, OAuth and image-service values. This frontend does not copy, read or store those server credentials. Verify `http://localhost:8080/v3/api-docs` or `/swagger-ui/index.html` is reachable. Use `localhost` consistently for both apps; do not mix it with `127.0.0.1`.

Use a real verified test account to sign in. The frontend contains no default account or hardcoded administrator password. Signup creates a USER. Obtain the first ADMIN through the backend's existing provisioning process; an existing administrator can then create more administrators here.

First real integration check: sign in as ADMIN → open User directory → open one user → reload that page → sign out. Then try the same admin deep link as USER and confirm no admin data is displayed. Do not use production accounts for mutation tests.

## Implemented screens

- Authentication: login, signup, check-email/resend, explicit email verification, password recovery/reset, Google redirect/callback, incomplete-profile onboarding.
- Admin: current counts, recent users/actions, searchable/filterable/paginated directory, user details, profile edits, confirmed role/status changes, administrator creation, filtered audit records and expandable details.
- Account: overview, profile/contact editing, profile photo validation/upload/removal, current/pending email, change or initial password, device list and session revocation.
- Shared: responsive workspace shells, role guards, loading/empty/error states, server field errors, confirmation dialogs, unsaved form protection, rate-limit feedback, accessible labels and keyboard focus styles.

The optional accessories shop is outside this release because the backend has no commerce APIs.

## Architecture

```text
src/app/               router and admin/account layouts
src/features/auth/     authentication pages and provider
src/features/admin/    administrator API and screens
src/features/account/  account API and screens
src/shared/api/        request boundary, DTO schemas and validation
src/shared/auth/       in-memory session coordinator and auth contract
src/shared/ui/         reusable controls, forms and dialogs
src/shared/styles/     design tokens and responsive base styles
src/test/              test setup
```

React Router loads the three feature page modules lazily. TanStack Query owns server data. Query keys include an authentication epoch and current user ID. Logout/identity replacement cancel requests and clear private caches; late responses cannot restore an earlier session. React Hook Form + Zod handle forms. The request boundary validates successful DTOs at runtime, parses Spring ProblemDetail extensions, supports multipart and 204 responses, and times out stalled requests after 20 seconds.

Access tokens remain in memory. Cookies are browser-managed with `credentials: include`; protected APIs also receive a bearer header. Eligible reads get at most one refresh/replay. Mutations, wrong-password errors and public verification/reset calls are not replayed automatically. Uncertain form writes require a reload before another submission.

Refreshes are coordinated within a tab and across tabs with Web Locks and an ephemeral BroadcastChannel. No bearer is persisted to localStorage, sessionStorage or IndexedDB. Login/logout share the cookie lock; logout clears every tab immediately and discards late refresh results. Current browsers with Web Locks, BroadcastChannel, AbortSignal.timeout and AbortSignal.any are required. Unsupported coordination displays an explanatory error instead of silently falling back to unsafe refresh races.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
npx playwright install chromium firefox webkit
npm run test:e2e
```

Vitest covers HTTP normalization, validation, return-path safety, mutation recovery policy, concurrent refresh, logout during refresh, cross-tab messages, storage avoidance, forms and screen contracts. Playwright defines 13 critical journeys for Chromium, Firefox and WebKit, including member authorization, self-demotion, two-tab refresh/logout, mobile overflow and accessibility checks. Its HTTP fixtures are synthetic and live only under `e2e/`; they are never imported by production code. Browser traces are disabled to avoid storing authentication traffic by default.

The browser suite runs against the development server at port 5173 and uses intercepted API responses. It does **not** prove real Spring cookie/CORS or third-party integration. Test real services separately with controlled accounts and an isolated backend. The `.github/workflows/frontend.yml` workflow runs checks and browser fixtures when this folder is used as the repository root. If retaining the parent Java monorepo, move/adapt that workflow at the repository root and set the frontend working directory before enabling it.

Local verification results are recorded in `IMPLEMENTATION_STATUS.md`. Headless Chromium was blocked by this session's macOS sandbox before tests could execute; the browser matrix remains unverified here. The actual sign-in page was inspected through the in-app browser.

## Backend limitations reflected in the UI

1. Current-account responses omit `hasPassword`. Security uses an explicit “existing password / first password” selection; the server decides whether the chosen operation is valid.
2. Pending email is separate from current email. Pending-email resend/cancel is unavailable; repeating the same pending address is blocked locally. Admin responses omit pending email, so an edit shows a request receipt and preserves the current address. Email-only requests are not fully audited by the backend.
3. Refresh session IDs rotate. Revoke actions re-read the list and refuse stale selected IDs, but a race can still occur at the server. The page explains this and the possible 15-minute access-token delay. “Revoke others” is disabled when the current cookie-backed session cannot be identified.
4. Administrator creation is immediate, active and email-verified; it is not an invitation. There is no user deletion, bulk action, manual unlock, export or normal-member creation API in the admin console.
5. Profile photos are capped slightly below 5 MiB to accommodate the backend's whole-multipart-request limit. The server controls cropping.
6. Summary counts come from separate paged queries; they are not an atomic analytics snapshot. Audit filters match the implemented API and do not invent date filtering.
7. Incomplete onboarding requires username and phone. Optional photo upload is available immediately afterward in the profile page.

## Production deployment

`npm run build` produces `dist/`. With no production override, the API base is explicitly same-origin. `.env.production.example` documents this setting. A local `.env.local` pointing at HTTP localhost will deliberately fail production configuration validation; remove that local override for the production build or supply an HTTPS deployment origin.

Prefer one HTTPS origin with `/api/`, `/oauth2/` and `/login/oauth2/` proxied to Spring. `deploy/nginx.conf.example` is a reviewable routing/header example, not an installed deployment. Keep API/OAuth requests outside SPA fallback. Supply the actual TLS certificate, backend host, image allowlist and trusted-proxy policy. A separate HTTPS API origin also requires an updated CSP connect-src and exact credentialed CORS origin.

Before exposing this publicly, configure Secure cookies and correct redirects in Spring; verify CSRF protection for cookie-authenticated flows; test real refresh rotation, last-admin protection and both workspaces with the deployed origin. Confirm Google callback/mail links, image uploads, keyboard/dialog behavior and mobile layouts. The current source changes do not modify Spring security or deploy either application.
