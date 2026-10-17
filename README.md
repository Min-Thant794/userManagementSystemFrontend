# User Management System Frontend

A React and TypeScript application for the User Management System Spring Boot API. One application provides two protected workspaces: `/admin` for administrators and `/account` for personal account management.

The frontend includes password and Google sign-in, registration and verification, account recovery, profile editing, session management, and an administrator dashboard.

| Resource           | Link                                                                              |
| ------------------ | --------------------------------------------------------------------------------- |
| Web application    | [Open UMS](https://user-management-system-frontend-mocha.vercel.app/)             |
| Backend repository | [userManagementSystem](https://github.com/Min-Thant794/userManagementSystem)      |
| Backend API        | [Render deployment](https://usermanagementsystem-api.onrender.com/)               |
| API documentation  | [Swagger UI](https://usermanagementsystem-api.onrender.com/swagger-ui/index.html) |

This is a learning and portfolio project. The deployed backend uses Render Free, so initial requests can be delayed while it wakes. No public administrator credentials are included.

## Contents

- [Features and routes](#features-and-routes)
- [Technology stack](#technology-stack)
- [Local development](#local-development)
- [Environment configuration](#environment-configuration)
- [Project structure](#project-structure)
- [Authentication and API behavior](#authentication-and-api-behavior)
- [Scripts and testing](#scripts-and-testing)
- [Deploy to Vercel](#deploy-to-vercel)
- [Google OAuth configuration](#google-oauth-configuration)
- [Current scope and limitations](#current-scope-and-limitations)
- [Troubleshooting](#troubleshooting)

## Features and routes

### Authentication and onboarding

| Route               | Purpose                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `/login`            | Sign in with username/email and password, or continue with Google      |
| `/signup`           | Register a member account                                              |
| `/check-email`      | Verification instructions and resend request                           |
| `/verify-email`     | Explicitly submit an email-verification token                          |
| `/forgot-password`  | Request a password-reset email                                         |
| `/reset-password`   | Set a password using a reset token                                     |
| `/oauth2/callback`  | Restore the session after Spring completes Google login                |
| `/complete-profile` | Supply the username and phone required for an incomplete OAuth profile |

### Administrator workspace

| Route                   | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| `/admin`                | Current account counts, recently joined users, recent administrator activity |
| `/admin/users`          | Search, filter, sort, and paginate users                                     |
| `/admin/users/new`      | Create an administrator                                                      |
| `/admin/users/:id`      | View profile/access details and confirm role or status changes               |
| `/admin/users/:id/edit` | Edit profile/contact information                                             |
| `/admin/audit-logs`     | Filter audit records and inspect recorded changes                            |

These routes require an authenticated `ADMIN`. The Spring backend enforces authorization independently of the frontend route guard.

### Personal account workspace

| Route               | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `/account`          | Personal account overview                              |
| `/account/profile`  | Edit username/phone and upload or remove a photo       |
| `/account/email`    | View current/pending email and request an email change |
| `/account/security` | Change a password or set the first local password      |
| `/account/sessions` | View devices/sessions and revoke sessions              |

Both `USER` and `ADMIN` accounts can access this workspace. `/` selects the appropriate landing page, `/forbidden` explains denied access, and unknown paths show a not-found page.

Shared UI includes responsive navigation, loading/empty/error states, form validation, server field errors, confirmation dialogs, unsaved-edit protection, rate-limit feedback, focus styles, and scrollable data tables.

## Technology stack

| Area                 | Technology                                                      |
| -------------------- | --------------------------------------------------------------- |
| Runtime              | Node.js 24; `.nvmrc` pins 24.19.0                               |
| UI                   | React 19, TypeScript, Vite                                      |
| Routing              | React Router with lazy-loaded feature pages                     |
| Server data          | TanStack Query                                                  |
| Forms and validation | React Hook Form, Zod, `@hookform/resolvers`                     |
| Styling and icons    | CSS Modules, shared CSS variables, Lucide React                 |
| Unit/component tests | Vitest, Testing Library, jsdom                                  |
| Browser tests        | Playwright: Chromium, Firefox, WebKit; axe accessibility checks |
| Code checks          | ESLint, Prettier, TypeScript                                    |
| Hosting              | Vercel static build with API/OAuth rewrites to Render           |

Exact dependency versions are pinned in [package.json](package.json) and [package-lock.json](package-lock.json). Use npm consistently so installs follow the committed lockfile.

## Local development

### Prerequisites

- Node.js 24 and npm. The package supports `>=24 <25`.
- A running Spring backend and its PostgreSQL/Redis dependencies for real sign-in.
- A current browser supporting Web Locks, BroadcastChannel, `AbortSignal.timeout`, and `AbortSignal.any`.

Dependencies install into the project, using the terminal in VS Code or any other terminal; they are not VS Code extensions.

### 1. Clone and install

```bash
git clone https://github.com/Min-Thant794/userManagementSystemFrontend.git
cd userManagementSystemFrontend
nvm install
nvm use
npm ci
```

The `nvm` commands use `.nvmrc`. If you use another Node version manager, install the version specified there before running `npm ci`.

### 2. Start the backend

Follow the [backend README](https://github.com/Min-Thant794/userManagementSystem#readme) to configure Spring, PostgreSQL, Redis, and the external services. The default backend origin is `http://localhost:8080`; its local CORS configuration allows `http://localhost:5173`.

### 3. Configure the API origin if needed

No environment file is required for the default local setup. For an explicit local override:

```bash
cp .env.example .env.development.local
```

```dotenv
VITE_API_BASE_URL=http://localhost:8080
```

On Windows PowerShell, use `Copy-Item .env.example .env.development.local`. The mode-specific filename keeps the local HTTP value out of production builds. Restart Vite after changing it.

### 4. Start the frontend

```bash
npm run dev
```

Open [localhost:5173](http://localhost:5173/). The port is strict: stop an existing process on 5173 if startup reports it is occupied. Use `localhost` for both apps rather than mixing it with `127.0.0.1`.

Signup creates a `USER` and requires email verification before password login. Use the backend's provisioning/recovery process for your first administrator; an existing administrator can create more through the dashboard. The frontend has no embedded account password.

### First integration check

1. Sign in as an administrator and open the user directory.
2. Open a user detail page, reload it, and confirm the session restores.
3. Sign out and sign in as a member.
4. Open an admin URL directly and confirm access is denied.
5. Test Google login, verification/reset mail, and photo upload with controlled test accounts.

## Environment configuration

The frontend reads one public application configuration value:

| Variable            | Development                         | Production on Vercel                                           |
| ------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Defaults to `http://localhost:8080` | Defaults to an empty string, using the current frontend origin |

An explicit production value is documented in [.env.production.example](.env.production.example):

```dotenv
VITE_API_BASE_URL=
```

An empty value makes `/api/...` requests go to Vercel, where [vercel.json](vercel.json) forwards them to Spring. For this deployment, leave the variable unset or explicitly empty in Vercel.

The value is an origin, with no `/api` suffix; endpoint paths already include `/api`. Nonempty production origins must use HTTPS and must not be localhost. See [config.ts](src/shared/api/config.ts) and [vite.config.ts](vite.config.ts).

Vite embeds public variables at build time. Changes in Vercel require a new deployment. A generic `.env.local` also applies during production builds; an old HTTP localhost value there will make production validation fail. Prefer `.env.development.local` for development-only settings.

Database credentials, JWT signing keys, Google client secrets, Gmail credentials, and Cloudinary secrets belong only in the backend environment. Never put them in `VITE_*` variables.

## Project structure

```text
src/
├── app/                  Router and protected workspace layouts
├── features/
│   ├── auth/             Login, signup, verification, recovery, onboarding
│   ├── admin/            Administrator screens and API calls
│   └── account/          Personal account screens and API calls
├── shared/
│   ├── api/              HTTP transport, response schemas, validation
│   ├── auth/             Session coordination and authentication state
│   ├── ui/               Forms, controls, tables, notices, dialogs
│   └── styles/           Shared tokens and responsive base styles
└── test/                 Vitest setup

e2e/                      Playwright journeys and mock API fixtures
deploy/                   Example Nginx configuration
.github/workflows/        Frontend CI checks
vercel.json               Vercel build settings and rewrite order
```

TanStack Query stores server data; forms and dialogs keep local UI state. Query keys include the user ID and an authentication epoch so private data can be cleared when sessions or identities change. Feature page modules load lazily through React Router.

## Authentication and API behavior

1. On page load, the authentication provider attempts to restore the session through `POST /api/auth/refresh`.
2. Login returns an access token and sets a browser-managed `HttpOnly` refresh cookie.
3. Access tokens stay in memory. Protected API calls attach a bearer header, and requests include cookies with `credentials: 'include'`.
4. The client loads `/api/users/me` and selects the appropriate workspace or onboarding route.
5. Eligible reads can refresh and retry once. Mutation requests are not automatically replayed.
6. Logout clears local private data and notifies other tabs before requesting server-side sign-out.

Web Locks serialize cookie-sensitive operations across tabs. BroadcastChannel shares short-lived session updates. Access tokens are not persisted in localStorage, sessionStorage, or IndexedDB. A missing refresh cookie on a first visit is handled as an unauthenticated session.

The request layer validates successful responses with Zod, understands Spring `ProblemDetail` errors, handles multipart uploads and empty 204 responses, and applies a **20-second request timeout**. A timed-out mutation may already have completed on the server; forms avoid silently retrying uncertain writes.

Frontend guards improve navigation, but permissions remain the backend's responsibility. The session UI also reflects the backend's distinction between revoking refresh sessions and immediately invalidating access JWTs.

## Scripts and testing

| Command                | Purpose                             |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Local Vite server on 5173           |
| `npm run typecheck`    | TypeScript validation               |
| `npm run lint`         | ESLint with zero warnings allowed   |
| `npm test`             | Run Vitest tests once               |
| `npm run test:watch`   | Run Vitest in watch mode            |
| `npm run build`        | Type-check and build `dist/`        |
| `npm run preview`      | Preview built static assets on 4173 |
| `npm run test:e2e`     | Run Playwright browser tests        |
| `npm run format:check` | Check formatting                    |
| `npm run format`       | Rewrite formatting                  |

### Unit and component checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Tests cover request/error handling, schemas, safe return paths, refresh concurrency, cross-tab/logout behavior, forms, and screen contracts.

### Browser checks

```bash
npx playwright install chromium firefox webkit
npm run test:e2e
```

On a Linux CI runner, use `npx playwright install --with-deps chromium firefox webkit` to install required system libraries too.

The suite defines **13 scenarios across three browsers: 39 test executions**. It covers administrator/member access, reload restoration, validation, onboarding, self-demotion, session coordination, desktop accessibility checks, and mobile page overflow.

Playwright starts the development server on 5173 and intercepts API calls to `http://localhost:8080`. Use the default development API origin for this suite; an override to Render or another origin bypasses those fixtures. Mock data lives under `e2e/` and is not imported by the production app. These tests do not validate real Spring cookies, Google login, SMTP, or Cloudinary.

Failures produce screenshots and context under `test-results/`. Browser traces are disabled in [playwright.config.ts](playwright.config.ts). Use the failure's assertion and artifact to distinguish layout, accessibility, and application failures.

### Continuous integration

[frontend.yml](.github/workflows/frontend.yml) runs on pushes and pull requests. It installs dependencies, checks types/lint, runs unit tests, builds the app, installs the three browsers, and runs Playwright. It uploads `dist/` and `test-results/` as the `frontend-build-and-test-results` artifact, retained for seven days.

CI verification and Vercel deployment are separate processes. Check both the GitHub Actions result and the Vercel deployment status after pushing changes.

## Deploy to Vercel

### Project settings

1. Push the frontend repository to GitHub and import it into Vercel.
2. Use the repository root as the Root Directory and **Vite** as the framework preset.
3. Select Node.js **24.x**, matching the supported major in `package.json`.
4. Use the committed build settings below and leave `VITE_API_BASE_URL` unset or empty.
5. Deploy, then configure the backend and Google callback for the stable frontend domain.

| Setting             | Value                |
| ------------------- | -------------------- |
| Install command     | `npm ci`             |
| Build command       | `npm run build`      |
| Output directory    | `dist`               |
| Production API base | Empty/current origin |

See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite). The committed [vercel.json](vercel.json) also defines the following routing order:

| Incoming path                  | Destination                                                                 |
| ------------------------------ | --------------------------------------------------------------------------- |
| `/api/:path*`                  | `https://usermanagementsystem-api.onrender.com/api/:path*`                  |
| `/oauth2/authorization/:path*` | `https://usermanagementsystem-api.onrender.com/oauth2/authorization/:path*` |
| `/login/oauth2/:path*`         | `https://usermanagementsystem-api.onrender.com/login/oauth2/:path*`         |
| Remaining application paths    | `/index.html`                                                               |

Keep the API/OAuth rules ahead of the SPA fallback. `/oauth2/callback` is a React route and must reach `index.html`. External rewrites let the browser keep using the Vercel origin while Vercel forwards requests to Render. [Vercel rewrite documentation](https://vercel.com/docs/routing/rewrites)

### Connect the backend

Set these values on the Render backend, along with its database, Redis, JWT, Google, mail, and Cloudinary variables:

```dotenv
SPRING_PROFILES_ACTIVE=prod
FRONTEND_ORIGIN=https://user-management-system-frontend-mocha.vercel.app
```

The backend `prod` profile enables HTTPS cookies and uses `FRONTEND_ORIGIN` for CORS, email links, and OAuth redirects. Use a stable frontend domain without a trailing slash. If deploying your own fork, update both the Render origin and the hardcoded Render destinations in `vercel.json`.

The current `SameSite=Lax` refresh-cookie design fits this same-origin proxy setup. Setting `VITE_API_BASE_URL` directly to an unrelated API domain changes cookie behavior and requires a coordinated backend CORS/cookie/CSRF review.

### Preview and other hosts

`npm run preview` serves `dist/` locally but does not apply Vercel rewrites. It is useful for inspecting the build; working production-style authentication requires an equivalent reverse proxy.

[deploy/nginx.conf.example](deploy/nginx.conf.example) is an optional starting point for another host. Supply its actual upstream and HTTPS settings. Its broad `/oauth2/` proxy rule also matches the React `/oauth2/callback` route: narrow that rule to `/oauth2/authorization/` so the final callback stays in SPA handling. That example is not automatically installed by Vercel.

## Google OAuth configuration

The Google button opens Spring's `/oauth2/authorization/google` endpoint, directly on `localhost:8080` in development and through Vercel in production. Spring handles Google's callback, sets the refresh cookie, and then sends the browser to the frontend's `/oauth2/callback` route to restore the session.

In Google Cloud, open **Google Auth Platform → Clients**, choose the Web application client matching the backend's `GOOGLE_CLIENT_ID`, and add the applicable **Authorized redirect URIs**:

```text
http://localhost:8080/login/oauth2/code/google
https://user-management-system-frontend-mocha.vercel.app/login/oauth2/code/google
```

The production entry uses the Vercel domain because Vercel forwards that callback to Spring. The React `/oauth2/callback` page is the final application destination, not the registered Google callback. URI matching must be exact, including the path and trailing slash. [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server)

## Current scope and limitations

- The personal workspace manages accounts. Products, accessories, carts, orders, and payments require future backend APIs.
- The current profile response omits `hasPassword`, so the security page asks whether the user is changing an existing password or setting the first one.
- Pending email remains separate from the current email. The backend has no pending-email cancellation/resend endpoint, and admin responses do not expose pending email.
- Administrator creation is immediate and verified. User deletion, bulk operations, manual unlock, exports, and normal-member creation are not admin features in the current API.
- Overview counts come from separate paginated queries, not an atomic analytics endpoint. Audit filtering supports the backend's actor, target, and action filters.
- Session IDs rotate with refresh tokens. The UI rechecks session data before revocation; concurrent activity can still change it. Revoking refresh sessions does not instantly invalidate all access JWTs.
- Photo uploads allow JPEG, PNG, and WebP from 50 to 4000 pixels per side. The client reserves 64 KiB below the backend's 5 MiB request limit; the UI describes this as up to 4.9 MiB. The server produces 300 × 300 avatars.

## Troubleshooting

| Symptom                                          | Check                                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| First login says the server took too long        | Render Free may be waking. The frontend times out after 20 seconds; wait for the backend and retry.                           |
| Missing refresh-cookie warning before login      | Startup attempts `/api/auth/refresh`. A signed-out visitor has no cookie yet; inspect the actual login request separately.    |
| `/login` returns 200 but sign-in does not finish | Inspect the following `/api/users/me` request and backend PostgreSQL/Redis logs.                                              |
| Google shows `redirect_uri_mismatch`             | Register the exact URI above on the correct Google OAuth client.                                                              |
| Refresh works locally but not after deployment   | Confirm production uses the Vercel origin, credentials are included, and API/OAuth rewrites are present.                      |
| A production build rejects localhost             | Check for a development override in `.env.local`; use `.env.development.local` for local settings.                            |
| API request returns HTML or an unexpected format | Check rewrite order, deployed backend availability, and the actual response in the Network panel.                             |
| A deep link returns 404                          | Confirm the hosting platform serves `index.html` for application routes.                                                      |
| Playwright cannot launch a browser               | Install its browsers/system dependencies and check the execution environment's permissions.                                   |
| A mobile test reports document overflow          | Inspect the measured viewport and table container. `.table-scroll` is positioned to contain its visually hidden table header. |
| Email verification/reset never arrives           | Check backend SMTP errors. Render Free blocks the SMTP port used by the current Gmail implementation.                         |

Render documents approximately one minute to wake a Free service after it has been idle for 15 minutes, and blocks outbound SMTP ports 25/465/587 on Free web services. See [Render Free limitations](https://render.com/docs/free). These infrastructure conditions are separate from the mocked browser tests.

**Author:** [Min Thant Tun](https://github.com/Min-Thant794).
