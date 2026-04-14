# Project Progress Report — April 14, 2026

## 1. Test Discovery & Configuration Fixes
*   **Jest RootDir Fix**: Modified `backend/jest.config.ts` to use `rootDir: '.'` instead of `src`. This allows Jest to correctly discover and execute tests located in the `backend/test/` directory.
*   **ESM Support**: Added mocks for ESM-only packages like `p-limit` and `striptags` in the Jest environment to prevent syntax errors during test execution.
*   **Path Aliasing**: Configured `moduleNameMapper` in Jest to support `@/` aliasing for internal backend imports.

## 2. Test Coverage Improvements
Successfully increased backend test coverage from **~20% to 44%** (Stmts). Key modules are now significantly more robust:

| Module | Before | After | Status |
| :--- | :--- | :--- | :--- |
| `SignalsService` | 0% | 100% | ✅ High |
| `SignalsRepository` | 0% | 58% | ✅ Medium |
| `RedisService` | 10% | 94% | ✅ High |
| `FeedService` | 0% | 86% | ✅ High |
| `ScorerService` | 0% | 100% | ✅ High |
| `AdminService` | 0% | 83% | ✅ High |
| `AuthService` | 0% | 95% | ✅ High |
| `AI Providers` | ~10% | 83% | ✅ High |

## 3. Infrastructure & Automation
*   **Ephemeral Test Database**: Created `scripts/test.sh` which:
    1.  Spawns a temporary PostgreSQL container (`signalstack-db-test`).
    2.  Pushes the latest schema using Drizzle.
    3.  Runs E2E tests.
    4.  Cleans up the container automatically on completion/failure.
*   **Package Scripts**: Added `test:db:up`, `test:db:down`, and `test:e2e:ci` to `backend/package.json` for streamlined local and CI testing.

## 4. Frontend Fixes
*   **Trends Navigation Bug**: Resolved an issue on the homepage where the "Trends" icon was not navigating to `/trends`. Added an explicit `onClick` fallback with `router.push` and standardized the `Header` height to prevent layout shifts.

## 5. Deployment
*   **VPS Sync**: Successfully connected to `fazley@192.168.0.110` and performed a zero-downtime deployment using `scripts/deploy.sh`.
*   **Health Status**:
    *   Backend API: **Healthy (200 OK)**
    *   Frontend: **Healthy (200 OK)**
    *   PostgreSQL: **Healthy (Ready)**
    *   Redis: **Healthy**

## Next Recommended Steps
*   Improve coverage for `SignalsRepository` complex query methods (currently at 58%).
*   Increase coverage for `EmailService` and `DiscordService` (currently at 0%).
*   Keep the `STUDY_GUIDE.md` updated with these new testing architectural patterns.
*   Address `signalstack-geoip` container restarts by providing MaxMind API keys in the `.env` file.
