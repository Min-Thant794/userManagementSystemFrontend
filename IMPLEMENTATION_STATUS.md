# Implementation status — 17 October 2026

## Delivered

One React/Vite/TypeScript app with the admin and account routes described in README.md. No backend files changed. No production mock adapter, hardcoded account or durable token storage. Dependency versions are exact and package-lock.json is included.

## Verification

- TypeScript, ESLint and Prettier: passed.
- Production build: passed; the measured initial login JavaScript was approximately 147 KB gzip, below the document's 250 KB target. This measures bundle transfer size, not LCP.
- Vitest: 37 tests passed across six test files.
- Dev server: returned HTTP 200 at http://localhost:5173. Sign-in page inspected in the in-app browser; API-unavailable feedback displayed as expected.
- Playwright: 13 journeys defined for three browser engines. Attempting Chromium failed before executing test steps because macOS denied its Mach-port bootstrap operation. Two launch failures were reported; the remaining cases did not run. Firefox/WebKit were installed but not executed. No browser-matrix, axe, mobile-overflow or end-to-end pass is claimed.
- Real Spring integration: not run; http://localhost:8080 was unavailable. OAuth, email delivery, image upload, cookie/CORS and live database mutations remain unverified.

## Release work still required

Run the browser suite in an environment that allows browser launch, resolve any discovered failures, then exercise real Spring-backed journeys using isolated test accounts. Verify every current backend limitation in README.md. Measure mobile LCP/CLS and verify keyboard/dialog behavior, long content, 320/768/1440 px layouts and 200% zoom. Configure/review production HTTPS, reverse proxy, cookies, redirects, CSP and CSRF before publishing.

The GitHub Actions workflow is supplied for a dedicated frontend repository; adapt its working directory if retaining the current Java parent repository.
