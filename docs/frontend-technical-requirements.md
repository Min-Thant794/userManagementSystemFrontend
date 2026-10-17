# User Management System Frontend Requirements

Admin dashboard and client account portal

Prepared for Min Thant Tun • 17 October 2026 • Version 2

## 1 Product scope and starting decision

Build one frontend application with two protected workspaces, /admin and /account. The existing Spring API is sufficient for an administrator console and a useful client account portal. Build one React and TypeScript application with separate admin and account layouts, a shared authentication layer, and feature folders that can grow independently.

The first client release should help a person manage their identity, profile photo, password, email change, and signed-in devices. A shopping experience is a separate product extension. Its layouts are included in the companion wireframe atlas, but products, inventory, carts, orders, payments, and shipping need new backend capabilities.

This document defines frontend requirements, current API contracts, required integration behavior, proposed backend improvements, and acceptance criteria. The companion layout atlas specifies visual arrangement and responsive behavior. Requirements marked **Current** map to source-defined capabilities; **Proposed** identifies a new contract or product decision. A source-defined endpoint still needs a browser integration check against the running service.

| Release        | Deliverable                                                                                          | Completion condition                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Foundation     | Login, refresh, logout, route guards, shared request layer                                           | Refreshing a protected page restores the account without a redirect loop |
| Admin first    | Overview, user directory, user details, edit, role/status changes, administrator creation, audit log | An ADMIN completes the management workflows and a USER cannot use them   |
| Client next    | Registration, verification, recovery, OAuth completion, account profile, photo, security, sessions   | A USER can manage their own account across desktop and mobile            |
| Future product | Optional accessories shop and order area                                                             | Business APIs and server-side transaction rules exist before release     |

### What to build first

Make the first vertical slice small: login → current account → admin user list → user detail → logout. This verifies cookies, CORS, bearer authentication, roles, pagination, and deployment routing before investing in all screens. Use mocked fixtures for visual development, then remove mock adapters from production builds.

### Reading map

Sections 2–5 cover architecture and authentication. Sections 6–10 specify API and data contracts. Sections 11–15 describe functional requirements. Sections 16–20 cover shared states, design rules, future commerce, delivery order, and verification. Sections 21–27 provide setup commands, module boundaries, cache policies, HTTP and authentication contracts, implementation tickets, and CI acceptance gates. Sections 28–29 provide source references.

---

## 2 Frontend architecture and tool choices

**Recommended architecture:** a client-rendered React application using Vite and TypeScript. This fits the current private admin and account workflows and keeps Java Spring responsible for application data and authorization. Revisit server rendering if a public catalog later needs search visibility and rich link previews. React documents both framework-based starts and a Vite-based learning path; this project already supplies its backend [W1].

| Responsibility        | Recommended choice                          | Requirement                                                                              |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| UI and types          | React with strict TypeScript                | Separate API DTOs from display models; avoid untyped API data                            |
| Build and development | Vite; Node 24 LTS baseline                  | Pin a supported patch release and commit the dependency lockfile [W2, W3]                |
| Routing               | React Router                                | Nested public, account, and admin layouts; lazy-load feature routes [W4]                 |
| Server data           | TanStack Query                              | Explicit query keys, loading/error states, cancellation and invalidation [W1]            |
| Forms                 | React Hook Form and Zod                     | Reusable field validation and form-level error handling [W5, W6]                         |
| HTTP                  | A small typed wrapper around fetch          | Bearer headers, credentials, 204 handling, refresh coordination and error normalization  |
| Styling               | CSS Modules plus shared CSS design tokens   | One component vocabulary across both interfaces; no need for a second UI system          |
| UI primitives         | Accessible dialog, menu and form primitives | Native controls where possible; inspect keyboard and focus behavior                      |
| Tests                 | Vitest, React Testing Library, Playwright   | Logic/components plus browser-level critical journeys; Chromium, Firefox and WebKit [W7] |

These are project recommendations, not Spring requirements. Select compatible stable package versions at setup, record them in the lockfile, and keep one package manager. Do not add Redux solely for API results: use the query cache for server data, local state for dialogs/forms, and a small auth provider for in-memory credentials and session status.

### Suggested project boundaries

```text
src/app/               router, providers, bootstrap, layouts
src/features/auth/     login, signup, verification, recovery, OAuth
src/features/admin/    overview, users, audit
src/features/account/  profile, photo, password, sessions
src/shared/api/        client, error parser, DTO types, auth retry
src/shared/ui/         inputs, buttons, tables, dialogs, states
src/shared/styles/     tokens, typography, responsive rules
src/test/              fixtures, request mocks, test utilities
```

Each feature owns its screens, API functions, schemas, and tests. Components call feature hooks; they do not assemble URLs or refresh credentials themselves. Keep future commerce in its own feature folder when its contract is ready.

---

## 3 Local setup and deployment requirements

The source config already expects a frontend at **http://localhost:5173**. Keep that origin while starting. If the dev server changes port automatically, CORS and email/OAuth redirects can break; configure a strict port. Spring commonly serves at port 8080 here; confirm the running application rather than inferring a deployment URL.

### First development session

1. Start the existing Spring service and its configured PostgreSQL and Redis dependencies. Verify its active profile and listening port.
2. Open `/swagger-ui/index.html` and `/v3/api-docs` on the backend. Compare actual responses with Sections 6–10, especially pagination and authentication errors.
3. Create the frontend using the React TypeScript Vite template. Install the selected router, query and form packages. Enable strict TypeScript and linting.
4. Set a public configuration value such as `VITE_API_BASE_URL=http://localhost:8080`. Set the dev port to 5173. No database, JWT signing, SMTP, OAuth client secret, or Cloudinary secret belongs in a Vite variable or browser bundle.
5. Integrate login and a protected GET before building the dashboard. Inspect cookie delivery and the preflight response in the browser.

### Browser request contract

Use `credentials: 'include'` for login, refresh, logout, OAuth session bootstrap and session-management calls; a consistent API wrapper may use it for all API requests. Protected calls also require `Authorization: Bearer <accessToken>`. The refresh cookie alone does not authorize `/api/admin/**` or `/api/users/**`.

Current CORS allows the configured origins, credentials, methods GET/POST/PUT/PATCH/DELETE/OPTIONS, and headers Authorization/Content-Type. `Retry-After` is not exposed in this CORS configuration. Add an exposed-header rule before relying on that header across origins; until then use a conservative 60-second fallback for a 429 [S4, W8].

### Hosting plan

Prefer one HTTPS origin serving the frontend with `/api`, `/oauth2`, and `/login/oauth2` reverse-proxied to Spring. This simplifies cookies and CORS. Configure SPA fallback for frontend routes, while API errors and OAuth endpoints must reach Spring rather than return index.html.

Set secure cookies to true in HTTPS production, update frontend email-link and OAuth redirect URLs, register the backend OAuth callback URI, and review trusted proxy/forwarded headers. Use the same hostname consistently in local development; localhost and 127.0.0.1 are different cookie hosts.

Separate origins on the same site can work with deliberate CORS and cookie settings. Unrelated frontend/API sites are incompatible with assuming the current SameSite=Lax refresh cookie will work on cross-site fetch. Choose the hosting topology first; do not fix failures by broadly opening CORS.

---

## 4 Routes permissions and navigation

| Frontend route                | Audience                         | Screen and behavior                                                  |
| ----------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| `/login`                      | Public                           | Identifier/password login; Google sign-in; recovery and signup links |
| `/signup`                     | Public                           | Register a normal USER; verification instruction after success       |
| `/check-email`                | Public                           | Generic verification receipt and resend form                         |
| `/verify-email?token=…`       | Public                           | Explicit verification action; success, invalid and expired states    |
| `/forgot-password`            | Public                           | Email form with generic request receipt                              |
| `/reset-password?token=…`     | Public                           | New and confirm password; consume token only on submit               |
| `/oauth2/callback`            | Public transition                | Refresh session, load account or route to profile completion         |
| `/complete-profile`           | Authenticated incomplete account | Required username and phone; optional photo                          |
| `/admin`                      | ADMIN                            | Current account counts, recent users and admin actions               |
| `/admin/users`                | ADMIN                            | Search, filters, server pagination and sort                          |
| `/admin/users/new`            | ADMIN                            | Create administrator; register before `:id` route                    |
| `/admin/users/:id`            | ADMIN                            | Profile, access/status and target-user audit views                   |
| `/admin/users/:id/edit`       | ADMIN                            | Dedicated profile edit form                                          |
| `/admin/audit-logs`           | ADMIN                            | Read-only filtered audit records and detail expansion                |
| `/account`                    | Authenticated complete account   | Personal account home                                                |
| `/account/profile`            | Authenticated complete account   | Edit profile, pending email and profile photo                        |
| `/account/email`              | Authenticated complete account   | Dedicated current and pending email screen                           |
| `/account/security`           | Authenticated complete account   | Password controls with capability limitations                        |
| `/account/sessions`           | Authenticated complete account   | Device sessions and revocation                                       |
| `/forbidden`, unmatched route | Any                              | Accessible permission or not-found page with recovery link           |

An ADMIN may use their personal account pages. A USER must never be routed into an admin page after login. Both roles use the same login API; the server determines authorization. Navigation visibility improves usability but does not protect resources.

### Guard order

Resolve authentication first. While bootstrap is pending, show a small loading shell. If unauthenticated, redirect to login with a sanitized local return path. If the server requests profile completion, show that flow before normal account/admin navigation. Once `/me` succeeds, use its role to select `/admin` or `/account`. On admin API 403, recheck the account and clear admin cache if privileges changed.

Allow return paths only within the frontend and only to routes the resolved account may access. Do not trust a URL parameter, locally edited role, or decoded JWT claim as an authorization decision. Avoid rendering protected content for a frame before a guard resolves.

---

## 5 Authentication lifecycle and session safety

Current login and refresh responses contain `accessToken`, `tokenType`, and `expiresIn` in **seconds**. Configured access lifetime is 900 seconds; refresh lifetime is seven days. The refresh token is an HttpOnly cookie named `refreshToken`, scoped to `/api/auth`, SameSite=Lax, with Secure controlled by deployment configuration [S1, S4].

### Required client behavior

1. On a protected-page load, call refresh without a stale bearer header. Store the returned access token in memory, then GET `/api/users/me` with the bearer token.
2. After password login, follow the same `/me` hydration step. Login itself does not return a user object or role.
3. If an eligible protected read fails due to an expired/invalid access credential, coordinate one shared refresh operation and replay it at most once. Mutations default to no automatic replay; Section 24 defines their recovery policy. Concurrent requests in a tab must await that same promise.
4. Do not treat every 401 as token expiry. A wrong current password and an invalid verification/reset link also return 401. Login, email-link, password change, and initial-password errors remain attached to those forms; do not blindly replay them.
5. A terminal credential failure during refresh ends automatic recovery. Clear the access token and private query data, then show login or the relevant blocked-account message. A transport failure instead shows an unavailable state with retry; keep protected content hidden while identity is unresolved. At initial anonymous bootstrap, a missing refresh cookie currently returns framework 400; treat this as signed out and avoid an infinite retry or frightening error screen.
6. On logout, immediately invalidate local credentials and private queries, broadcast logout, then execute cookie-authenticated logout through the session coordinator. Replace navigation history with login. If the network fails, explain that this browser was cleared but server logout was not confirmed; offer retry rather than reporting complete server revocation.

### Refresh rotation across browser tabs

The backend rotates refresh tokens and detects reuse. Coordinate refresh across tabs too, for example with a same-origin Web Lock and a lightweight BroadcastChannel session protocol. Re-read session state after acquiring the lock. Broadcast logout/account changes; do not persist bearer or refresh tokens to browser storage. Verify behavior with two tabs and simultaneous expiry. If cross-tab coordination is deferred, record forced re-login as a known integration risk and fix it before release.

### OAuth and incomplete profiles

Start Google sign-in through top-level navigation to `/oauth2/authorization/google` on Spring. On success Spring sets the refresh cookie and redirects to the configured frontend callback with `profileComplete` only. No access token is returned in the URL. Treat the query value as a hint, perform refresh, and let the API determine the next route.

An incomplete profile cannot GET `/me` under the current filter. A 403 with `action: complete_profile` must open the completion form without requiring `/me` to succeed first. Completion submits username and phone; then hydrate `/me`. Photo operations are also allowed before completion. Logout remains available.

### Security requirements

Keep access/refresh tokens out of localStorage/sessionStorage, URLs, logs and analytics. Email verification/reset tokens intentionally arrive in links and should be captured and scrubbed as described in Section 6. In-memory bearer storage reduces persistence but still requires XSS prevention. Render user and audit content as text; use a restrictive Content Security Policy and HTTPS. CSRF is currently disabled in Spring; before public deployment define and test CSRF defenses for cookie-authenticated refresh/logout and authentication flows. CORS is not a complete CSRF defense [W9, W10].

---

## 6 Authentication API contract

All paths below are current. Send only named request properties. JSON unknown properties are rejected by configuration. An empty success has no JSON body; the request wrapper must not call `response.json()` for a 204.

| Method and path                      | Request                                | Success                                                         |
| ------------------------------------ | -------------------------------------- | --------------------------------------------------------------- |
| `POST /api/auth/signup`              | username, email, phoneNumber, password | 201 UserResponse; verification starts; no authenticated session |
| `POST /api/auth/login`               | identifier, password                   | 200 AuthResponse and refresh cookie                             |
| `POST /api/auth/refresh`             | Cookie; no JSON required               | 200 AuthResponse and rotated refresh cookie                     |
| `POST /api/auth/logout`              | Cookie if present                      | 204; revokes current refresh token and clears cookie            |
| `POST /api/auth/verify-email`        | token                                  | 204                                                             |
| `POST /api/auth/resend-verification` | email                                  | 204                                                             |
| `POST /api/auth/forgot-password`     | email                                  | 204                                                             |
| `POST /api/auth/reset-password`      | token, newPassword                     | 204                                                             |

```json
{
  "accessToken": "<in-memory value>",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

### Registration and email links

Signup creates a USER and asks them to verify email before password login. Show a confirmation page and an email-based resend form. Do not send confirmPassword or role to signup. The source email links already target `/verify-email` and `/reset-password` at frontend port 5173; preserve those routes unless the backend configuration is updated together.

Read token query parameters into transient page state. Use an explicit submit action to consume them, which avoids unintended duplicate requests during development rerenders and link preview handling. Remove tokens from visible URL/history once safely captured and avoid third-party resources on these pages. A reload after removing an unused token should tell the user to reopen their email link.

Resend and forgot-password success copy should remain generic: “If this address can receive the message, check your inbox.” Do not invent an account-existence lookup. An expired verification link should lead to the resend form; an expired reset link should lead to a new reset request. Avoid automatically resending on each page visit.

### Source versus API annotations

The login annotation mentions 423 for lockout, but the implementation returns 403 for locked/suspended accounts. Invalid verification/reset tokens return 401 despite annotations describing 400. Initial-password setup for an account that already has a password also returns 401. Handle these as workflow errors, not automatic session-expiry recovery [S1, S4].

Current verification links last 24 hours; password-reset links last 30 minutes. Requesting a replacement invalidates previous unused tokens for that workflow. After successful reset or email-change confirmation, require fresh sign-in because refresh sessions are revoked. New-account email verification leads to login. Do not display an exact expiry countdown without an issued-at/expiry value for that specific link. Login locks after five failures for 15 minutes; the login error does not supply a reliable lock-until timestamp for a countdown.

---

## 7 Current account and session API contract

These routes require a bearer access token. Include credentials for the session routes so the backend can identify the current refresh session.

| Method and path                         | Request                                   | Success                                           |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| `GET /api/users/me`                     | None                                      | 200 UserResponse; incomplete profiles are blocked |
| `PATCH /api/users/me`                   | Changed username, email, phoneNumber      | 200 UserResponse                                  |
| `PUT /api/users/me/password`            | currentPassword, newPassword              | 204; revokes all refresh sessions                 |
| `PUT /api/users/me/password/initial`    | newPassword                               | 204; for accounts without a local password        |
| `POST /api/users/me/complete-profile`   | username, phoneNumber                     | 200 UserResponse                                  |
| `PUT /api/users/me/photo`               | Multipart field named file                | 200 UserResponse                                  |
| `DELETE /api/users/me/photo`            | None                                      | 200 UserResponse                                  |
| `GET /api/auth/sessions`                | Refresh cookie identifies current session | 200 SessionResponse array                         |
| `DELETE /api/auth/sessions/{sessionId}` | Numeric session ID in path                | 204                                               |
| `DELETE /api/auth/sessions/others`      | Current refresh cookie                    | 204                                               |

### UserResponse

Current fields are `id` (UUID), `username`, `email`, `pendingEmail`, `phoneNumber`, `role`, and `profileImageUrl`. Allow null where the source can provide an incomplete value or missing photo/pending email. Treat UUIDs as strings. This response does **not** expose `hasPassword`, `emailVerified`, `profileComplete`, status, creation date, or linked-provider details.

Consequently, client mockups must not pretend to have a reliable verification badge, account age, linked-Google status, or automatic password mode from `/me`. A signed-in-via-Google hint does not prove that the account lacks a local password. Section 15 defines the interim password UI and the proposed capability field.

### SessionResponse

Current fields are `id` (Java Long), `device`, `location`, `lastUsedAt`, `createdAt`, and `current`. There is no separate IP, expiry, provider, or login-history field. Location can be an approximate place or a raw-IP fallback; use “Unknown” when absent. These are refresh-session records, not historical logins. IDs and timestamps reset on rotation; createdAt describes the current token row rather than the original device sign-in. Refetch and use the latest IDs.

On successful password change, clear local auth and send the user to login with a success message because refresh sessions were revoked. Setting an initial password does not revoke existing refresh sessions in this implementation. Revoking refresh sessions does not automatically invalidate every already-issued access JWT; do not promise instant sign-out on other devices. See Section 15.

---

## 8 Administrator API contract

All routes below require a complete, active, unlocked ADMIN account. The backend rechecks current user access on subsequent requests. Use one shared error layer and preserve server decisions on conflicts.

| Method and path                      | Input                                               | Success                               |
| ------------------------------------ | --------------------------------------------------- | ------------------------------------- |
| `GET /api/admin/users`               | search, role, status, page, size, sort              | 200 PageResponse of AdminUserResponse |
| `GET /api/admin/users/{id}`          | User UUID                                           | 200 AdminUserResponse                 |
| `PUT /api/admin/users/{id}`          | Changed username, email, phoneNumber                | 200 AdminUserResponse                 |
| `PATCH /api/admin/users/{id}/status` | status: ACTIVE or SUSPENDED                         | 200 AdminUserResponse                 |
| `PATCH /api/admin/users/{id}/role`   | role: USER or ADMIN                                 | 200 AdminUserResponse                 |
| `POST /api/admin/users`              | username, email, phoneNumber, password              | 201 AdminUserResponse; creates ADMIN  |
| `GET /api/admin/audit-logs`          | actorUserId, targetUserId, action, page, size, sort | 200 PageResponse of AuditLogResponse  |

### AdminUserResponse

Fields: `id`, `username`, `email`, `phoneNumber`, `role`, `status`, `emailVerified`, `failedLoginAttempts`, `lockedUntil`, `profileComplete`, `profileImageUrl`, `createdAt`, `updatedAt`. Render absent OAuth username/phone as “Not provided.” Show temporary lock from a future `lockedUntil` separately from the ACTIVE/SUSPENDED status badge.

The DTO does not contain pendingEmail, hasPassword, lastLoginAt, or permissions. An admin cannot inspect another user's sessions through the existing session API; that API operates on the authenticated account only.

### AuditLogResponse

Fields: numeric `id`, `actorUserId`, `targetUserId`, `action`, `details` object, `createdAt`. The available actions are ROLE_CHANGE, SUSPEND, REACTIVATE, UPDATE, and ADMIN_CREATED. Role/status events contain before/after values; UPDATE contains before/after profile objects; ADMIN_CREATED contains username/email. Unknown detail structures must remain readable as escaped JSON.

Actor and target names are not included. Use shortened UUIDs, full-value copy controls, and links to user details. Resolve names only through a bounded, deduplicated cache if needed. Missing records retain their UUID instead of breaking the audit row. Do not label this as a complete login/security activity feed.

### Mutation semantics

Although admin profile editing uses PUT, the service treats null fields as unchanged. Send changed editable fields only. Changing a role/status to its existing value is a successful no-op and does not create a new audit entry. Administrator creation directly creates an active, email-verified ADMIN; it is not an invitation workflow.

---

## 9 Pagination filters and query state

The application enables Spring page serialization through a DTO. Read totals from the nested `page` object. The included HTTP test asserts `page.totalElements` [S3, S5].

```ts
type PageResponse<T> = {
  content: T[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
};
```

| Concern      | Frontend requirement                                                                    |
| ------------ | --------------------------------------------------------------------------------------- |
| Page index   | Send page=0 for the first page; display Page 1                                          |
| Page size    | Explicit default 20; offer 20/50/100 as UI choices, not claimed server limits           |
| User search  | Trim visible input; debounce 300 ms; search username/email/phone; cancel stale requests |
| Filters      | Role and status combine with search; reset to page zero on changes                      |
| User sort    | Initially createdAt descending; expose only verified persistent fields                  |
| Audit sort   | createdAt descending; add a stable ID tie-breaker only after verifying support          |
| URL state    | Store search/filter/page/sort in route query parameters for back navigation             |
| Empty page   | Refetch or step back when changes make the current page invalid                         |
| Result count | Use page.totalElements, never content.length as a global count                          |

User search uses case-insensitive substring matching on username/email and substring matching on phone. `%` and `_` are currently unescaped SQL LIKE wildcards; do not describe it as exact matching. No server filter currently exists for verified email, incomplete profile, lock state, or creation date.

Audit filters accept exact actor UUID, target UUID and action. There is no date-range or free-text audit search. A user-detail Audit tab can reuse the audit endpoint with `targetUserId` and its own pagination.

### Query cache rules

Use keys such as `['admin-users', params]`, `['admin-user', id]`, `['audit', params]`, `['me']`, and `['sessions']`. Invalidate relevant lists, details, counts and audit queries after successful mutations. Refetch self-profile when editing your own record. Clear private cache completely on logout or identity change.

Retain a previous table during a background refetch with a clear updating state, but never show another account's cached records after account switching. For access/status mutations, wait for the server before displaying success; optimistic privilege changes can misrepresent a rejected last-admin operation. Disable automatic retries for mutations and 400/401/403/409/429 responses; make transient GET retries bounded and deliberate.

---

## 10 Forms validation and field behavior

Client validation gives immediate feedback; Spring remains authoritative. Put a visible label above every field, connect errors with aria-describedby, and focus the first invalid field after submit. Keep passwords out of diagnostic logs and do not trim them automatically.

| Field                   | Current backend rule                         | Frontend treatment                                                          |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| username                | 3–50 characters; letters, digits, underscore | Text input; validation hint; preserve uniqueness errors                     |
| email                   | Valid email; DTO maximum 255                 | Email input; nonblank when supplied; address the schema mismatch below      |
| phoneNumber             | 7–15 digits; optional leading +              | Telephone input; show accepted format; no spaces/hyphens in submitted value |
| password or newPassword | Minimum 8; at least one letter and digit     | Show/hide button; rule hints; allow paste and password managers             |
| currentPassword         | Nonblank                                     | Existing-password autocomplete; wrong-password error stays in form          |
| identifier              | Nonblank username or email                   | One text field; avoid email-only validation                                 |
| role                    | USER or ADMIN                                | Fixed select; send enum value, display readable label                       |
| status                  | ACTIVE or SUSPENDED                          | Explicit action and confirmation rather than an instant switch              |
| token                   | Nonblank                                     | Read from email link; never ask users to manually paste a JWT               |

Confirm-password fields are frontend-only and must match the new password. Omit them from API payloads. Likewise, do not send disabled/read-only response fields back to mutations. An empty optional field is not automatically “unchanged”; construct a payload from deliberately changed fields and validate any supplied email as nonblank.

### Validation discrepancies to resolve

The request DTO and Flyway table definition use 255 characters for email, while the User entity declares 235. This is a metadata inconsistency, not evidence that the running database rejects 236–255 characters. Align the entity with the intended schema and test boundary inputs. Match the published DTO limit in the frontend once the running schema is verified [S2, S3].

The server has no password maximum in these DTOs. Do not advertise invented uppercase/symbol requirements. If password policy changes, update Spring validation, help text, form schemas and tests together.

### Profile photo

Submit a FormData body with the field `file`; let the browser set the multipart boundary. The source validates JPEG, PNG and WebP, a 5 MiB file limit, and image width/height of 50–4000 pixels. The configured multipart file and total-request limits are both 5 MB. Use a practical frontend cap just below the limit or raise the total-request cap server-side, since multipart overhead also counts. File extension alone is insufficient; server validation still decides acceptance.

Show a local preview, pending upload state, replacement action, remove-photo confirmation, and fallback initials. Revoke preview object URLs when discarded. The server transforms the image to a 300×300 JPEG using face-focused cropping; preview copy must explain that the final crop may differ. A user-controlled crop editor is optional frontend work. Preserve the old photo on upload failure and update all account-avatar locations only after a successful response.

---

## 11 Admin overview and user directory requirements

### ADM01 Overview

The overview should help an administrator find accounts needing attention and reach common tasks. The wireframe shows three factual counts: Total users, Active accounts and Suspended accounts. Query `/api/admin/users?size=1` with the corresponding filters and read `page.totalElements`. An optional fourth count, Active administrators, can use both `role=ADMIN` and `status=ACTIVE`. These are separate snapshots; they may briefly differ while accounts change.

Show recent users from a small page sorted by creation date, and recent administrator actions from audit logs. A count card links to the correctly filtered directory. Provide Create administrator and View users as meaningful actions. A failed count displays “Unavailable” with retry, not zero. Do not include revenue, online users, weekly growth, login charts or unverified-user totals without supporting endpoints.

Acceptance: the displayed count is independent of table page size; clicking Suspended accounts opens that filter; a failed count does not remove successful data from other sections.

### ADM02 User directory

Desktop layout uses a persistent sidebar, top bar, page heading/primary action, search/filter toolbar, table and pagination footer. Table columns: identity (avatar, username and email), role, status, verification, joined date, and View action. Keep phone, lock details and UUID in the detail view to avoid a wide default table.

Search hint must name username/email/phone. Use separate role and status filters with a clear reset action. Reflect filters in the URL. Include visible sort state in supported column headers. Rows use a real detail link; essential actions must work with keyboard and must not rely on clicking an unlabeled row.

On narrow screens show user cards with identity, role/status, and View details. Filters stack or open a clearly labeled panel. Pagination remains reachable. Do not simply shrink all desktop columns into unreadable text.

Acceptance: typing rapidly does not show results for an older query; filter change resets the page; back navigation restores the list context; zero results offer Clear filters; server failure offers Retry without pretending the list is empty.

### Deliberate omissions

There is no generic administrator-created USER endpoint, account deletion, bulk operation, unlock action, impersonation, permission editor, or full CSV export contract. Keep those controls out of the working MVP. A future export must specify scope and permission explicitly rather than silently exporting only the visible page.

---

## 12 Admin detail editing and access changes

### ADM03 User detail and profile edit

Use a header with avatar, username/email, role and status. Provide Profile, Access and status, and Audit tabs. Profile shows contact fields and record timestamps. Access shows role, status, verified email, profile completion, failed-login count and lock expiry. Audit reuses the targetUserId filter.

The edit form changes username, email and phone only. Show Save changes and Cancel with unsaved-change protection. Keep entered values on 400/409. Return updated values from the server into the local record and invalidate dependent views.

**Email change behavior:** a successful edit starts verification for the new address while current email remains active. The admin response omits pendingEmail. Show a local receipt naming the submitted address and explaining that verification is required; do not immediately replace confirmed email in the detail view. Persistence of this pending state requires a proposed DTO addition. An email-only admin edit also misses the current UPDATE audit detection; fix that backend gap before claiming a complete change history.

### ADM04 Role and status actions

Use a confirmation dialog naming the account, current value, proposed value, and effect. Use “Suspend account,” “Reactivate account,” “Grant administrator access,” and “Change to user.” Cancellation must make no request. Disable repeat submission while pending and close only after confirmed success.

The backend prevents suspending or demoting the last active administrator with 409 `Cannot Remove Last Admin`. Explain that another active administrator is required and retain the old value. A frontend count is advisory and can be stale; it cannot replace this server check. Test concurrent last-admin changes before production.

Self-demotion or self-suspension is possible when another active admin exists. Confirm the loss of access explicitly. After success, discard admin-only cache and re-evaluate the signed-in account. Redirect a demoted user to `/account`; show an access-blocked state for suspension. Do not leave an interactive stale admin screen visible.

### ADM05 Create administrator

Use username, email, phone, password and frontend-only confirm password. The role is fixed ADMIN, with explanatory text that this grants management access and creates an account directly. The service marks email verified immediately; do not call this an invitation or promise an acceptance email.

After a 201, clear password fields and open the created record. On uncertain network failure, check for an existing account before retrying creation. A production improvement is an administrator invitation/activation flow; it is not required to draw or integrate the current form.

---

## 13 Admin audit requirements

### ADM06 Audit browsing

Display timestamp, action, actor, target and a details action. Default to newest first and paginate on the server. Use action, actor UUID and target UUID filters only. Help text may explain that UUIDs can be copied from user detail. A date picker and general text search would imply missing server features.

Map enum values to readable labels: Role changed, Account suspended, Account reactivated, Profile updated, and Administrator created. Keep the original enum available in developer diagnostics, not as the only user-facing label.

### Details and navigation

Open an accessible drawer or dialog from the row without discarding the list filters. Render before/after fields side by side on desktop and stacked on mobile. Highlight changed values with labels as well as color. Provide a readable fallback for empty or unrecognized details. Values may contain personal information: restrict the page to admins and do not send raw audit records to third-party analytics.

Actor/target UUIDs remain useful when display names cannot be resolved. A link to a deleted/unavailable user should show a resource-not-found state without removing the historic audit entry. Do not fabricate missing names or dates.

### Acceptance criteria

1. A role change displays its before and after values after a successful refetch.
2. Target filtering from a user detail shows only that user's events, and clearing it returns to the general audit view.
3. An empty result explains that no matching administrator actions were found; it does not claim that the account has no login history.
4. Unknown details render as safe text; markup in a field cannot execute.
5. A narrow screen offers timestamp, action, actor/target summary, and an accessible details button without page-wide overflow.

### Scope of the existing audit trail

The available audit enum covers selected administrator operations. Login, logout, failed login, password reset, personal profile updates and device activity are not a complete supported audit feed. The email-only admin update gap described in Section 12 is particularly relevant if audit completeness becomes a release requirement.

For a later expanded security audit, define event types, actor/subject semantics, retention, redaction, filter parameters and permission rules as a separate backend feature. Avoid inferring business events from UI button clicks; a record should represent a confirmed server action.

---

## 14 Client authentication and account experience

### CLI01 Shared authentication pages

Use one consistent centered form layout, approximately 420–480 px wide on desktop, with generous side padding on mobile. Login contains identifier, password, show/hide, sign-in action, forgot-password link, Google sign-in and create-account link. Avoid a Remember me checkbox because the backend does not expose a separate session-lifetime choice.

Signup has username, email, phone, password and confirm password, visible rules, and a link to login. A successful registration transitions to Check your email. Unverified login offers a resend path with an email input because the identifier may have been a username.

Forgot-password is an email form and generic receipt. Reset-password includes new and confirm password and an invalid-link recovery state. Email verification has working, success and invalid/expired states. OAuth cancellation/failure returns to a recoverable login state; a dedicated backend failure redirect is a proposed integration improvement.

### CLI02 Complete profile

For an incomplete OAuth account, collect username and phone number with the same validation as signup. Optional photo is secondary. Completion is necessary before entering normal account/admin pages. Do not force password creation: Google accounts can remain without a local password. Preserve duplicate-field errors in place.

The current service returns a misleading profile-incomplete exception when completion is attempted on an already complete profile. If this happens after a stale page or back navigation, try `/me` and route to the normal landing page if it succeeds; do not create a completion loop.

### CLI03 Account home

Use a lighter account shell with Home, Profile, Security and Devices navigation. Show avatar, username and current email, followed by practical links to edit profile, manage password and review devices. A pending email banner is available from `/me.pendingEmail`. Do not add membership tier, reward points, orders, account age or a fabricated security score.

### CLI04 Profile and pending email

Separate the photo area from the contact form. Edit username and phone together; give email change its own explanatory section. Keep the current email visible while the new address awaits verification. A pending banner shows the new address and the sent-message receipt. After confirmation, require fresh sign-in and load the new server state.

Pending-email resend needs a backend fix: the public resend service sends only when emailVerified is false, while a normal verified account remains true during an email change. Submitting the same pending address again can conflict with its own pending-email record. Do not show a working resend action for this state until an authenticated pending-email resend contract is implemented. Signup verification resend remains a separate supported flow.

No cancel-pending-email endpoint exists. A different new address may initiate another change, but a Cancel pending change button needs a backend contract. Save buttons become active only for valid changed fields; leaving a dirty form requires a discard decision.

---

## 15 Client password and device requirements

### CLI05 Password security

For accounts with a local password, use current password, new password and confirm password. On successful change, clear local auth and show “Password changed. Sign in again.” Refresh sessions were revoked. For an account without a password, use new password and confirmation; success leaves the current session usable under the current implementation.

**Current capability gap:** `/me` does not return hasPassword. Do not infer it from Google sign-in or store a permanent guessed flag. Prefer adding a boolean `hasPassword` to the account response before polishing this screen. Until then, show a Change password form with an explicit “Set a password for the first time” alternate form and clear explanatory copy. Keep server rejections local to the chosen form; the backend rejects the wrong operation with 401.

MFA, passkeys, connected-provider management, recovery codes and security questions are future features. They must not appear as working controls. Password strength guidance may supplement the current server policy, but it must not claim a score guarantees account security.

### CLI06 Devices and sessions

Show one row/card per returned session: device, approximate location, creation time, last-used time and Current session label when `current` is true. Format timestamps in the viewer's locale, with exact date/time and timezone available. Never label lastUsedAt as a guaranteed “last login”; it tracks the stored session behavior.

Provide Sign out for a selected other session and Sign out other devices after confirmation. If the current session cannot be identified, disable the bulk “other devices” action and ask the user to refresh or sign in again. The current implementation can revoke every session when the matching cookie is absent, so do not call it blindly.

For the current device, use the logout workflow. After revoking another session, refetch the list; if a stale session ID returns 404, explain that it is already unavailable and refresh. A stale ID can also return 204 while revoking an old row and leaving the latest rotated token usable. Individual revocation targets one refresh-token row, not a stable device-session family. Propose stable family identifiers and family-wide revocation before promising reliable remote device termination, and test revocation racing with refresh.

### Honest revocation copy

The access-token filter does not consult refresh-session revocation on every request. Existing valid access tokens may remain usable until their expiry, currently up to roughly 15 minutes. State “This device will need to sign in again when its current access expires,” rather than promising immediate remote logout. If instant revocation is required, add an access-session or token-version check in Spring.

### Acceptance criteria

Two browser sessions are displayed correctly; current-session identification survives a normal refresh; revoking the latest token row prevents that token from refreshing; the stale-ID/rotation race is documented and tested; password change forces local reauthentication; first-password creation works for an OAuth-only account without affecting another user's account. Reliable device-wide revocation requires the proposed family-based contract.

---

## 16 Shared errors loading and recovery states

Normalize server failures to a frontend shape such as status, title, detail, fieldErrors, action and retryAfterSeconds. Many errors use ProblemDetail with `errors` for fields and `action` for next-step guidance. Framework failures may differ, so check content type and safely handle an empty/non-JSON body. Never show a stack trace or raw proxy HTML.

| Response or state                           | Required experience                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| 400 Validation Failed                       | Inline field errors plus a summary; retain entered values                            |
| 400 malformed/query/upload failure          | Safe form or page error; retry only after correction                                 |
| 401 on expired protected access             | One coordinated refresh and one replay where safe                                    |
| 401 wrong credentials or invalid email link | Form/link error; no refresh loop                                                     |
| 403 with action complete_profile            | Profile-completion flow; no repeated `/me` dependency                                |
| 403 with action resend_verification         | Verification explanation and resend form                                             |
| 403 Forbidden                               | Permission screen; recheck current role and remove inaccessible cache                |
| 403 Account Suspended                       | Access blocked copy; current contract may also represent temporary lock              |
| 404 on user/session                         | Resource unavailable; refresh list or return to its parent                           |
| 409 Duplicate Resource                      | Preserve form; show safe detail; field code is not guaranteed                        |
| 409 Cannot Remove Last Admin                | Keep existing role/status and explain required active administrator                  |
| 429 Too Many Requests                       | Respect Retry-After when readable; otherwise 60-second fallback; no auto retry storm |
| Network/5xx                                 | Retry for reads; preserve forms; mutation result may be uncertain                    |

### Required screen states

Every data page needs initial loading, loaded content, empty result, error/retry, and background-refresh states. Forms additionally need pristine, dirty, validation error, submitting, success, server error and discard states. Destructive dialogs need idle, pending and rejected states. Use skeletons matching the layout rather than arbitrary spinners everywhere.

A timeout after a mutation is ambiguous: the server may have committed it. Refetch before encouraging another create, email-send, or access change. Automatic retries can send duplicate emails or hide a conflicting update. The current API has no general idempotency-key or optimistic-concurrency contract.

### Backend improvements for a stable error contract

Propose machine-readable codes, separate locked/suspended responses, a lock expiry when appropriate, consistent missing-cookie 401, and predictable validation for query parameters. Keep these changes separate from the current implementation. Do not make frontend behavior depend on parsing English messages when a stable action/code can be added.

---

## 17 Design system responsive behavior and accessibility

The companion atlas provides actual wireframes. Use light neutral navigation and content surfaces, dark ink text, one teal action color, and restrained borders. The proposed core colors are ink #172B36, teal #006C67, surface #F2F6F7, border #CFD9DE and danger #AF3B3B. The client portal uses the same controls with more space around forms. Verify contrast in every component and theme.

| Token or component | Proposed specification                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| Desktop canvas     | Design at 1440 px; content max width around 1200 px                          |
| Admin shell        | 240 px sidebar, 64 px top bar, 32 px content inset                           |
| Spacing            | 4, 8, 12, 16, 24, 32 and 48 px scale                                         |
| Type               | System sans-serif; 16 px body/forms, 14 px table text, 24–32 px page heading |
| Controls           | 44 px preferred input/button height; visible focus ring                      |
| Surfaces           | White/light-neutral panels, 1 px subtle border, 8–12 px radius               |
| Table              | 56–64 px comfortable rows; compact mode only if readable                     |
| Desktop grid       | 12 columns with 24 px gaps; two-column forms only when fields fit            |
| Tablet             | Around 768–1199 px; collapse sidebar; 24 px page padding                     |
| Mobile             | Below about 768 px; one column, 16 px padding, menu drawer                   |
| Narrow test        | 320 px viewport; no horizontal page overflow                                 |

Breakpoints are implementation defaults, not device detection. Move a layout earlier if content no longer fits. Test long emails, missing names, large text, translated-length labels and validation messages. Dialogs become full-width sheets or pages on small screens; actions remain visible without covering fields or the keyboard.

### Shared component inventory

Build Button, TextField, PasswordField, Select, FormErrorSummary, StatusBadge, Avatar, Breadcrumbs, EmptyState, ErrorState, Skeleton, Pagination, DataTable, ConfirmDialog, Toast and PageHeader. Admin and client pages should reuse them. Status uses words as well as color. A toast supplements rather than replaces an inline error or result that the user needs to act on.

### Accessibility acceptance target

Target WCAG 2.2 AA: normal text contrast at least 4.5:1, appropriate non-text contrast, visible keyboard focus, semantic headings, accessible names and logical reading order. Use at least the AA 24×24 CSS-pixel target criterion subject to its exceptions; aim for 44×44 on touch controls. Do not describe 44 px as the universal AA minimum [W11].

Dialogs need focus containment, Escape dismissal when safe and focus restoration to the trigger. Use a tested primitive. Announce submit errors and completion results; do not announce each keystroke/refetch. Support keyboard-only navigation, 200 percent zoom and a screen-reader pass. Disabled controls require an understandable reason when they block an expected action.

---

## 18 Future client shopping extension

This is an optional accessories-store direction, chosen as a concrete example for future expansion. Every commerce screen in the atlas is a **future concept**. The current USER role supplies identity only; it does not establish a catalog, order, payment or ownership model.

| Future screen          | Layout and interaction                                                            | Backend dependency                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Store home and catalog | Brand/header, search, categories, filters, product grid; mobile filter sheet      | Products, categories, media, search and paginated filtering                                 |
| Product detail         | Image gallery, title, price/currency, variant selector, availability, add to cart | Product variants, inventory, server price and availability                                  |
| Cart                   | Line items, quantity controls, remove, estimated summary                          | Persisted cart, ownership, quantity rules and repricing                                     |
| Checkout               | Address, delivery option, review, payment handoff                                 | Addresses, shipping/tax rules, authoritative totals, order creation and payment integration |
| Order confirmation     | Order reference, confirmed status and next steps                                  | Confirmed server order/payment state; no success based only on redirect parameters          |
| Orders and detail      | Paginated orders, line snapshots, status timeline, delivery information           | Per-user order access, fulfillment events and status transitions                            |

### Proposed contract direction

Possible future resources are `/api/products`, `/api/products/{id}`, `/api/cart`, `/api/cart/items`, `/api/orders` and `/api/orders/{id}`. These names are proposals, not existing endpoints. Define request/response schemas and ownership checks before connecting the mockups. Store money with explicit currency and an exact representation; never trust totals or prices submitted by the browser.

A minimal first commerce increment can be a read-only catalog plus product detail. Add cart next. Checkout requires stock checks, price recalculation, an idempotent order-creation contract and a payment-provider integration with verified server callbacks. Avoid collecting raw card details in your own forms; use the provider's hosted/tokenized interface when that feature is designed.

### Reuse and new work

Reuse login, account identity, profile navigation, forms, loading/error states and protected routes. Add separate catalog and order services/models; do not store products inside the User entity. ADMIN authorization for user management does not automatically define who may manage inventory, refund a payment or view orders; write those policies explicitly.

The proposed store may later need indexable product pages. Reassess rendering architecture then, rather than adding server rendering to the first private admin interface solely for a hypothetical catalog. Keep future navigation hidden in the working account portal until its data and actions are available.

---

## 19 Implementation sequence and backend backlog

Work in testable vertical slices. Estimates depend on frontend experience and available time, so the stages below are ordered outcomes rather than promised dates.

| Stage                 | Work                                                                     | Exit condition                                                    |
| --------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1 Foundation          | Scaffold, tokens, layouts, request wrapper, auth bootstrap, error parser | Login, refresh, protected navigation and logout work in a browser |
| 2 Admin read paths    | Directory, filters, pagination, detail, audit                            | Real backend responses render and URL state survives navigation   |
| 3 Admin mutations     | Edit, role/status confirmation, create ADMIN, self-change handling       | Success/conflict/permission cases match server behavior           |
| 4 Admin finish        | Count overview, mobile layouts, keyboard flows                           | Complete admin journeys pass without fake data                    |
| 5 Client onboarding   | Signup, verify/resend, reset, Google callback, completion                | New local and OAuth users reach their correct account state       |
| 6 Client account      | Profile/email, photo, password, sessions                                 | Account workflows and multiple-device cases pass                  |
| 7 Release preparation | Deployment URLs, CSRF/cookie review, accessibility, CI                   | Release checklist in Section 20 passes                            |
| 8 Optional commerce   | Catalog first; cart/orders/payment after contracts                       | Business acceptance criteria and APIs agreed and tested           |

### Integration prerequisites

Before real browser work: working backend dependencies, test ADMIN and USER accounts, correct origin, email delivery/test inbox, and reachable OAuth callback configuration. The first admin prototype can proceed before Google/Cloudinary are configured if those integrations are explicitly deferred and hidden in that slice.

### Proposed backend work by priority

**Before public release:** review cookie/CSRF policy, use HTTPS Secure cookies, test refresh rotation with multiple tabs, test last-active-admin concurrency, and agree whether delayed access-token revocation is acceptable. Confirm that sensitive infrastructure credentials are kept server-side.

**During frontend integration:** expose `hasPassword`; consider `profileComplete` and `emailVerified` for account UI; allow a minimal identity/capability endpoint during onboarding if needed; fix pending-email resend and its own-address conflict; expose pendingEmail in admin DTOs; align email metadata; expose Retry-After over CORS; stabilize missing-cookie and locked-account errors. These improve correctness and UX but do not all block starting the admin list.

**Before promising complete audit history:** record email-change requests and completion accurately, add machine-readable event contracts, and test the expected action coverage.

**Before promising reliable remote device termination:** replace rotating refresh-row IDs with stable session-family IDs and revoke the entire family. Decide whether immediate access revocation is also required.

**Later when justified:** atomic dashboard summary, invite-admin flow, audit date filtering, export, server concurrency/version checks and instant access revocation. Commerce remains a separate backlog with its own data model.

---

## 20 Verification and definition of done

The following checks are requirements for the future implementation. They are not claims that the running backend or an implemented frontend has been tested by this document.

| Area            | Essential checks                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication  | Login with username/email; invalid credentials; verification required; reload with cookie; absent/expired cookie; logout failure; no redirect loop |
| Rotation        | Many requests expire together; one refresh per coordinator; two-tab refresh; reuse rejection; logout across tabs                                   |
| Authorization   | USER opens an admin deep link; direct forbidden API; admin loses role; suspension; incomplete profile cannot bypass onboarding                     |
| Directory       | Nested page envelope; zero-based pages; every filter combination; stale search cancellation; empty results; invalid page recovery                  |
| Admin mutations | Duplicate fields; same-value no-op; last-admin rejection; self-demotion; self-suspension; creation only yields ADMIN                               |
| Email           | Signup verification; expired link; resend; pending email remains distinct; new address becomes current only after verification                     |
| Passwords       | Wrong current password stays in form; valid change logs local client out; initial password on OAuth-only account; wrong mode rejected              |
| Photos          | Valid JPEG/PNG/WebP; wrong type; oversized/corrupt image; failed upload keeps old avatar; delete returns fallback                                  |
| Sessions        | Current identification with cookie; no-current guard; revoke other device; stale ID; access-token delay accurately described                       |
| UX and access   | Keyboard only; dialog focus; screen reader; contrast; 320 px; 200 percent zoom; long strings; loading/empty/error states                           |
| Deployment      | SPA deep links; API not swallowed by fallback; HTTPS cookies; CORS; OAuth and email redirects; CSP; no secrets in bundle                           |

### Testing layers

Unit-test response normalization, route decisions, validation and refresh coordination. Component-test forms, loading/empty/error behavior and confirmation dialogs. Browser-test the critical journeys against a controlled backend with known accounts and a test inbox; mock third-party failures where deterministic behavior is needed. Keep at least one integration path for each real service.

Run type checking, linting, production build and critical automated tests in CI. Use browser assertions on visible behavior rather than implementation-shaped tests. Test Chromium, Firefox and WebKit for cookie and layout behavior [W7].

### Proposed performance targets

Use route-level lazy loading; avoid loading future commerce code on admin login. Start with a working budget of 250 KB gzipped JavaScript for initial authentication rendering, then measure and adjust with evidence. On a defined mobile test profile, aim for usable rendering within 2.5 seconds, no visible layout shift from unsized avatars, and immediate pending feedback after submit. These are project targets, not measured results. API latency should be recorded separately from rendering time.

### Release definition

All MVP routes have real integrations and recovery states; no prototype data appears in production; unauthorized data stays inaccessible; refresh/session behavior is documented; mobile and keyboard flows are usable; tests and build pass; hosting URLs and cookie policy are verified; unsupported controls are hidden; and a short setup guide reproduces the environment from a clean checkout.

---

## 21 Frontend setup and development contract

Use one npm package for both workspaces. The following commands are a setup recipe for the future implementation, not evidence that a frontend has already been created. Run them in the parent directory where the frontend should live, separate from the Spring source tree unless a repository layout has been agreed.

```sh
npm create vite@latest ums-frontend -- --template react-ts
cd ums-frontend
npm install
npm install react-router @tanstack/react-query
npm install react-hook-form @hookform/resolvers zod
npm install -D vitest jsdom @playwright/test
npm install -D @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event
```

Select compatible stable releases when executing the recipe, commit the resulting lockfile, and use `npm ci` on later clean installs. The template supplies React, TypeScript and the initial Vite/ESLint configuration. Testing packages also require configuration; installing them alone does not create a working test suite. Install Playwright browser binaries in the development or CI environment used for browser tests. CSS Modules require no additional styling framework [W2, W7].

### Configuration files

Commit `package.json`, the lockfile, TypeScript project files, Vite and ESLint configuration, test configuration, `.env.example`, and a README. Enable strict TypeScript, set a shared `@/` source alias consistently in TypeScript and Vite if used, and retain React development checks. Avoid disabling type or lint rules merely to unblock a screen.

```text
# .env.example for direct local API access
VITE_API_BASE_URL=http://localhost:8080
```

In this specification, the base is an origin with no `/api` suffix; endpoint functions supply the complete paths from Sections 6–8. For the proposed same-origin production proxy, an explicitly empty base means the current origin. Reject malformed origins, unexpected path suffixes and production localhost targets during configuration validation. OAuth navigation uses the same backend origin with `/oauth2/authorization/google`. All Vite configuration values shipped to the browser are public.

### Local execution rules

Serve development at port 5173 with strict port selection. Confirm the backend port, allowed frontend origin, test accounts, database/cache dependencies and test inbox before integration. Test one real authenticated read before adding more screens. Pin a supported Node 24 LTS patch in the project and use it in CI; do not mix package managers or commit several competing lockfiles.

Keep fixtures and test accounts synthetic. The production entry point must never import a mock request adapter. The setup README must explain how to start dependencies, configure the API origin, run checks, obtain test accounts and reproduce one login-to-user-detail journey. Its instructions must work from a clean checkout without undocumented local files.

---

## 22 Module boundaries and protected route architecture

**Agreed frontend design:** one application, one build and one deployment, with separate admin and account workspaces. Both use the existing Spring API and shared authentication. This section specifies frontend implementation; it does not introduce backend endpoints or make route guards a security boundary.

### Ownership and dependency rules

| Module             | Owns                                                     | Allowed dependencies                         |
| ------------------ | -------------------------------------------------------- | -------------------------------------------- |
| `app`              | Providers, bootstrap, route tree, workspace layouts      | Feature public exports and shared modules    |
| `features/auth`    | Login, signup, recovery, completion, session coordinator | Shared API, validation and UI                |
| `features/admin`   | Overview, users, administrator creation, audit           | Shared API/UI and injected auth capabilities |
| `features/account` | Personal profile, email, photo, password, sessions       | Shared API/UI and injected auth capabilities |
| `shared`           | Transport, DTOs, error types, UI primitives, tokens      | Other shared modules only                    |

Each feature exposes a small public entry point. Admin and account features must not import each other's components, stores, hooks or internal files. Reusable components move to `shared/ui`; shared data normalization moves to API utilities. Shared code must not import a feature. Check import boundaries with lint rules. Keep endpoint functions and mutation hooks beside their feature, while authentication headers and refresh behavior remain centralized.

The application composition layer supplies auth state and narrow operations, such as requesting sign-out or rechecking identity, through a shared contract. Components must not read cookies, store bearer tokens, decode JWTs to grant permissions, or trigger independent refresh requests. Forms own draft values; the query cache owns server records.

### Route resolution and loading

Use the explicit authentication states in Section 25. Its unavailable state distinguishes a temporary transport failure from a confirmed logout or blocked account. Bootstrap resolves refresh and `/me` before mounting a protected workspace. Completion is a separate authenticated branch because the current backend blocks `/me` for incomplete profiles.

The root route renders public pages or a protected boundary. Within that boundary, `/account/*` accepts complete USER and ADMIN accounts; `/admin/*` additionally requires the current server-confirmed ADMIN role. An administrator can switch to their personal account through navigation without signing in again. After login, select an authorized saved return path, otherwise `/admin` for ADMIN and `/account` for USER.

Load page modules lazily and place loading/error boundaries around each workspace. Lazy loading improves delivery cost; server authorization still protects every request. Avoid eager admin data prefetch for USER sessions. Keep forbidden, not-found and failed-page recovery accessible outside a broken feature boundary.

Acceptance requires direct deep links, browser reload, back navigation, incomplete-profile routing and role loss to produce one stable destination without flashing protected content or looping.

---

## 23 Server state cache identity and mutation effects

**Frontend requirement:** use one query client and central key factory. The current API supplies no push notifications, entity versions or general idempotency keys. These cache rules specify client policy, not new server guarantees.

### Identity isolation and query keys

Expand Section 9's keys with a private scope: `['private', accountId, authEpoch, ...resource]`. `accountId` comes from `/me`; `authEpoch` changes when authentication is replaced or cleared, but remains stable during ordinary token refresh. Never put tokens or passwords in a query key. Bootstrap `/me` resolves identity before seeding the scoped cache; hide previously cached content while identity is unknown.

| Resource suffix             | Key parameters                                    |
| --------------------------- | ------------------------------------------------- |
| `['me']`, `['sessions']`    | No additional parameters                          |
| `['admin','users',params]`  | Normalized search, role, status, page, size, sort |
| `['admin','user',id]`       | Target UUID                                       |
| `['admin','count',filters]` | Exact role/status filters used for the count      |
| `['admin','audit',params]`  | Actor UUID, target UUID, action and pagination    |

Normalize omitted filters consistently and use typed parameter objects. Pass cancellation signals through the transport. On logout or identity replacement, increment the epoch, cancel private queries, discard private cached results and reset feature drafts. Ignore old-epoch request, refresh and mutation completions so a late response cannot restore credentials or repopulate another session's UI. Do not persist private query data in browser storage.

### Mutation effects

| Successful operation              | Required cache handling                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| Admin edit, role or status change | Update returned detail; invalidate user lists, counts and audit       |
| Create administrator              | Invalidate lists, counts and audit; navigate to returned user         |
| Personal profile/photo change     | Update `/me`; invalidate relevant self-detail/list entries if present |
| Revoke another session            | Refetch sessions; preserve the documented stale-ID limitations        |
| Password change or local sign-out | Clear private state and require fresh authentication                  |

Initial-password creation does not itself revoke sessions under the current contract. Personal mutations must not fabricate administrator audit events. Keep access changes pessimistic: a rejected last-admin operation leaves the previous record intact. For an uncertain mutation outcome, refetch before offering another submission.

After self-demotion, immediately cancel and remove admin queries, recheck `/me`, then replace navigation with `/account`. After confirmed self-suspension, remove protected content and enter access-blocked state; `/me` may now fail. On an unexpected admin 403, pause admin requests and recheck identity once. Do not repeatedly refresh tokens to overcome denied permission.

For reads, use an initial 30-second freshness target and refetch stale data on focus. Retain previous table results only within the same identity scope, with an updating indicator. Tests must cover account switching, late responses, self-access changes and invalidation across filtered pages. Query keys and default retry/refetch behavior are documented in [W12, W13]; the timings above are project choices.

---

## 24 Typed HTTP boundary and failure handling

**Implementation requirement:** admin and account features share one HTTP client. Components call typed feature functions such as `getCurrentUser`, `listUsers`, and `updateProfile`; only these functions select endpoint paths and request DTOs. The options below are a proposed frontend interface, not additional Spring endpoints.

```ts
type RequestOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  auth: 'public' | 'bearer' | 'refresh-cookie';
  body?: { kind: 'json'; value: unknown } | { kind: 'form'; value: FormData };
  signal?: AbortSignal;
  recovery: 'none' | 'refresh-once';
  result: 'json' | 'empty';
};
```

The shared client prefixes a configured API origin and always includes credentials. It adds an in-memory bearer only for `auth: bearer`. Login, refresh and public token-consumption requests receive no stale Authorization header. JSON bodies use Content-Type application/json; FormData receives no manually assigned Content-Type. Construct payloads from request schemas, excluding confirmation fields and response-only properties. The current server rejects unknown JSON properties [S1, S2, S5].

**Response handling:** a 204 resolves without parsing. JSON endpoints validate the expected envelope at the boundary; TypeScript generics alone do not validate server data. Preserve nullable fields, nested pagination and offset timestamps. A successful response with an unexpected shape becomes a contract error with a safe message, rather than an apparently empty list.

Normalize failures into a discriminated model: `kind` is http, network, timeout, aborted, or contract; HTTP failures carry `status`, safe `title`/`detail`, `fieldErrors`, optional `action`, and optional `retryAfterSeconds`. Read ProblemDetail extensions when present; tolerate missing, empty and non-JSON bodies. Cancellation caused by navigation is silent. Validation/conflict errors retain input and remain with the originating form. Never render raw HTML or arbitrary server markup.

**Recovery policy:** refresh-once is opt-in, initially for protected reads. One coordinated refresh may replay an eligible 401 request once. Never refresh recursively or replay wrong-password, login, verification, reset, or initial-password failures. Mutations default to no automatic replay; their 401 errors require operation-specific handling because status alone does not identify token expiry. Query-library retries must not duplicate this recovery layer.

Reads may retry one transient network/502/503/504 failure with short jittered backoff. Do not apply transport/query retries to 400/401/403/404/409/429 or mutations; the single eligible 401 authentication recovery above is the only exception. Show a retry action for uncertain writes after refetching relevant state. Respect readable Retry-After; current cross-origin CORS needs the proposed exposed-header change [S4].

Log only method, route template, duration and safe error classification. Omit Authorization, cookies, passwords, email-link tokens, query strings containing tokens, and request/response bodies. Tests must cover 204, malformed bodies, cancellation, multipart boundaries, one-refresh recovery, wrong-password 401 and an uncertain mutation result.

---

## 25 Authentication state transitions and coordination

**Implementation requirement:** one auth provider controls both workspaces. Its explicit states are bootstrapping, anonymous, authenticating, onboarding, authenticated, blocked, unavailable, and signingOut. Only authenticated contains a hydrated account and role. Store access token and expiry in memory; refresh remains the browser-managed HttpOnly cookie. These state names are frontend recommendations; the current Spring contracts remain unchanged [S1, S2, S4].

| Event                               | Transition                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| App initialization                  | bootstrapping → credentialed refresh → GET `/api/users/me`; do not mount protected content yet                        |
| Missing/invalid refresh             | anonymous; current missing-cookie 400 is expected during bootstrap                                                    |
| Refresh transport failure           | unavailable with retry/sign-in choices; avoid falsely reporting bad credentials                                       |
| Password login submit               | authenticating → login → memory token → `/me`; failure returns to the form                                            |
| `/me` succeeds                      | authenticated; ADMIN lands at `/admin`, USER at `/account`, subject to a valid authorized return path                 |
| `/me` requests completion           | onboarding when 403 contains `action: complete_profile`                                                               |
| Explicit account suspension or lock | blocked; show recovery guidance without a retry loop                                                                  |
| Logout requested                    | signingOut → clear private local state → server logout → anonymous, with unconfirmed-server-logout feedback if needed |

For Google, navigate to Spring's authorization route. `/oauth2/callback` enters bootstrapping and exchanges the refresh cookie for an access token; `profileComplete` is a hint only. Completion submits username/phone, then repeats `/me`. If a stale completion form returns the already-complete error, attempt `/me` once. Signup leads to check-email; successful email verification leads to login. Neither creates an authenticated session. Password change/reset and confirmed email change require fresh login; initial-password creation currently preserves sessions.

Within a tab, all eligible callers await one shared refresh promise. A route cancellation must not cancel recovery needed by other callers. Attach an auth-generation number to protected work: logout, account switching or terminal failure increments it. Discard responses from older generations and clear private query caches so a late response cannot restore the previous account.

Across tabs, use a same-origin exclusive refresh lock and an ephemeral BroadcastChannel protocol. After acquiring the lock, check whether another tab already supplied a newer usable token; otherwise refresh using the latest cookie. Publish successful token/expiry updates only in memory, never localStorage, sessionStorage or IndexedDB. Peers hydrate identity through `/me`; a broadcast is not authorization. Coordinate logout with the same lock so an in-flight refresh finishes before cookie-clearing logout. Broadcast logout immediately to clear every tab's UI. Ignore refresh broadcasts from a cycle invalidated by logout, even if they arrive afterward.

Test duplicate initialization, simultaneous 401s, two-tab expiry, logout during refresh, account switching and tab closure. If the chosen coordination mechanism is unavailable, provide a tested fallback or block release; the current backend revokes a token family on refresh reuse.

---

## 26 Implementation tickets and dependency order

Use `/admin` and `/account` layouts inside one package, with one lockfile, request layer and deployable build. Demonstrate ticket exits against a controlled backend. Dependencies refer to completed tickets. Finish the admin release through FE-08 before full client implementation. Until then, keep unfinished account actions hidden and provide a minimal account home with sign-out.

| Ticket                       | Depends on   | Implementation and observable exit criterion                                                                                                                                                             |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-01 Foundation             | None         | Configure TypeScript, linting, tokens and controls. A clean install starts at port 5173; both shells render at 320 and 1440 px.                                                                          |
| FE-02 Request boundary       | FE-01        | Implement typed requests, credentials, bearer injection, 204 handling and normalized errors. Fixtures demonstrate JSON success, empty success, field errors, non-JSON failure and cancellation.          |
| FE-03 Authentication         | FE-02        | Implement login, bootstrap, refresh coordination and logout. Reload restores sessions; simultaneous failures share recovery; anonymous bootstrap stops without looping.                                  |
| FE-04 Workspace guards       | FE-03        | Add role-aware nested routing and navigation. USER deep links cannot render admin content; ADMIN can reach their own account; incomplete-profile responses route to onboarding.                          |
| FE-05 Admin read slice       | FE-04        | Build directory and detail with URL-backed filters and pagination. Back navigation restores filters; totals use nested page metadata; stale search results never replace newer results.                  |
| FE-06 Admin mutations        | FE-05        | Add edit, administrator creation and confirmed role/status actions. Duplicate and last-admin errors retain values; successful self-demotion removes admin navigation and cached records.                 |
| FE-07 Overview and audit     | FE-05, FE-06 | Add counts, recent records and audit details. Counts ignore page length; target-user audit links preserve filters; unknown details render safely.                                                        |
| FE-08 Admin release          | FE-07        | Complete responsive, keyboard and failure states. Management browser journeys pass, unsupported controls remain absent, and production builds contain no fixture adapter.                                |
| FE-09 Client entry flows     | FE-08        | Add signup, verification, recovery, Google callback and completion. New local and OAuth test accounts reach the correct destination; invalid links stay outside auth-refresh loops.                      |
| FE-10 Profile and photo      | FE-09        | Add contact editing, pending-email display and avatar actions. Current email remains unchanged until verification; failed uploads preserve the old photo; unsupported pending-email resend stays hidden. |
| FE-11 Passwords and sessions | FE-10        | Add documented password-mode fallback and session controls. Wrong-password errors remain local; missing current-session identification disables “other devices”; stale session IDs trigger refresh.      |
| FE-12 Client release gate    | FE-11        | Run both workspaces together. Account switching clears private data; two-browser session behavior matches documented limitations; mobile and keyboard acceptance checks pass.                            |

Track backend-dependent enhancements separately. Missing `hasPassword` uses the documented alternate-form fallback; reliable session-family termination requires backend work. Finished mockups do not satisfy these dependencies.

---

## 27 Build configuration CI and release acceptance

Use these proposed package scripts as a reproducible starting contract. Install the matching tool dependencies and commit their configuration. `test` is non-interactive for CI; local watch mode is separate.

```json
{
  "dev": "vite --port 5173 --strictPort",
  "typecheck": "tsc -b --pretty false",
  "lint": "eslint . --max-warnings 0",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "build": "tsc -b && vite build",
  "preview": "vite preview --port 4173 --strictPort"
}
```

### Configuration ownership

Commit `.env.example` with public placeholders, the lockfile, the pinned Node version, and setup instructions. Keep `.env.local`, browser-auth test state and credentials untracked. `VITE_API_BASE_URL` is browser-visible; validate its format at startup and show a configuration error rather than making requests to an accidental fallback. Production should fail its build/configuration check when the API target contains localhost. Vite values are embedded during build, so document environment-specific builds. Follow Section 21: the base is an API origin, or explicitly empty for same-origin production. Endpoint paths already contain `/api`; do not duplicate it.

### CI pipeline

For each pull request: restore the approved Node version, run `npm ci`, type checking, linting, non-interactive tests, and production build. Then serve the compiled output and run the critical browser suite against an isolated test backend. Preview on port 4173 requires a matching test CORS/redirect configuration; do not assume the development origin permits it. Keep backend startup and readiness checks explicit.

Preserve build output, test reports and failure traces as CI artifacts. Redact tokens, passwords and personal test data from logs; restrict trace access because traces can include requests. Use controlled synthetic accounts and cleanup. Never run destructive tests against production. Merge only after required jobs pass; an automatic rerun must not conceal a flaky failure.

### Proposed measurable targets

| Gate           | Acceptance measurement                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Build          | Zero type errors, lint warnings and failing required tests                                                              |
| Payload        | Initial authentication JavaScript at most 250 KB gzipped; record build sizes                                            |
| Layout         | No page-wide overflow at 320, 768 and 1440 px; 200% zoom remains usable                                                 |
| Accessibility  | Zero serious/critical automated findings; manual keyboard and dialog-focus checks pass                                  |
| Rendering      | Median LCP at most 2.5 seconds over five cold-load runs on a recorded mobile profile; CLS at most 0.1                   |
| Authentication | Ten concurrent expired requests cause one refresh per tab coordinator; a two-tab test completes without a redirect loop |

These are proposed acceptance targets, not measured results. Record browser, throttling and backend conditions with performance evidence. Release the immutable tested build, verify deep links, cookies and both workspace entry routes on the deployed origin, and retain the previous build for rollback. A release note must identify remaining backend-dependent limitations.

---

## 28 Backend evidence and contract maintenance

The backend references below point to file sections in the supplied `spring-project.txt` snapshot. Line numbers refer to that text dump. They identify the implementation used for the requirements and should be rechecked when the backend changes.

| Reference                  | Source and relevant dump lines                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 Authentication          | AuthController 6575–6897; AuthService 6898–7039; auth DTOs 7040–7266; EmailVerificationService 7321–7428; PasswordResetService 7579–7665; SessionService 7823–7892            |
| S2 Current account         | User DTOs 9318–9527; ProfileImageService 9528–9644; User entity 9653–9736; UserController 9737–9958; UserService 9977–10126                                                   |
| S3 Admin                   | AdminAuditLogController 5519–5564; AdminUserController 5565–5858; AdminUserService 5859–6097; admin DTOs/specifications 6124–6470; AuditAction 6471–6481                      |
| S4 Security and errors     | GlobalExceptionHandler 7920–8041; SecurityConfig 8283–8382; CookieUtil 8474–8511; JWT handlers/filter 8512–8709; OAuth success handler 9054–9101; rate-limit filter 9102–9214 |
| S5 Configuration and tests | Application page serialization 10127–10147; application.properties 10164–10233; HTTP admin tests 12859–12941; security policy tests 13391–13453                               |

### Contract maintenance requirements

Keep a reviewed API contract snapshot with the frontend. Compare generated OpenAPI types against actual responses where source behavior and annotations differ, especially login lockout, invalid email links, initial-password rejection and the nested page envelope. Generated TypeScript types cannot correct an inaccurate backend annotation.

When the backend changes a DTO or workflow, update endpoint functions, runtime response checks, form schemas, error handling and the relevant acceptance tests together. Record proposed endpoints separately until they exist. Do not silently infer new capabilities from a role name or from a successful HTTP status with an unfamiliar response body.

The source snapshot supports the requirements in this document. Browser integration, backend concurrency behavior and production deployment must still pass the implementation gates. The reference wireframe explorer uses sample data and is not proof of API integration.

### Version 2 implementation scope

The approved architecture is one deployable frontend with admin and account workspaces. This version adds an executable setup recipe, dependency boundaries, identity-scoped cache rules, request recovery policy, explicit auth states, twelve ordered implementation tickets and measurable release targets. Shopping remains outside the initial release.

---

## 29 Official technical references

[W1] React documentation, Build a React app from scratch. Architecture options, Vite, routing and server-data library discussion. https://react.dev/learn/build-a-react-app-from-scratch

[W2] Vite documentation, Getting started. Setup and runtime compatibility. https://vite.dev/guide/

[W3] Node.js release table. Supported LTS baseline. https://nodejs.org/en/about/previous-releases

[W4] React Router documentation, Declarative installation. https://reactrouter.com/start/declarative/installation

[W5] React Hook Form official repository and documentation. https://github.com/react-hook-form/react-hook-form

[W6] Zod documentation, Basic usage. https://zod.dev/basics

[W7] Playwright documentation, Installation and supported browser engines. https://playwright.dev/docs/intro

[W8] MDN documentation, Cross-Origin Resource Sharing. https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

[W9] OWASP HTML5 Security Cheat Sheet. Browser storage and session-identifier guidance. https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html

[W10] Spring Security documentation, Cross Site Request Forgery. Use the documentation matching the backend's installed Spring Security version when implementing changes. https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html

[W11] W3C Web Content Accessibility Guidelines 2.2 and target-size explanation. https://www.w3.org/TR/WCAG22/ and https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum

[W12] TanStack Query documentation, Query keys. Include every data-changing parameter in a serializable query key. https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

[W13] TanStack Query documentation, Important defaults. Review retry, freshness, focus refetch and cache collection settings explicitly. https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

External documentation checked on 16 October 2026. Package versions and recommended APIs may evolve; the lockfile and a tested integration remain the project's version authority.
