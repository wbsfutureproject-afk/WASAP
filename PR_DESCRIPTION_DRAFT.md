## Summary

This PR upgrades the WBS app into a stricter frontend-backend flow with token-based API access, adds full CRUD endpoints for core entities, improves submit UX reliability, and adds release/verification guardrails for safer deployment.

## What Changed

### Backend

- Added bearer-token auth for all `/api/*` routes except `/api/health` and `/api/auth/login`.
- Updated login response to include token in `data.token`.
- Added CRUD endpoints for:
  - KTA (`GET/POST/PUT/DELETE` per-item + existing bulk endpoints)
  - TTA (`GET/POST/PUT/DELETE` per-item + existing bulk endpoints)
  - Users (`GET/POST/PUT/DELETE`)
  - Departments (`GET/POST/PUT/DELETE`)
  - PICs (`GET/POST/PUT/DELETE`)

### Frontend

- Switched API usage to strict token-based behavior and centralized request handling.
- Added automatic session invalidation/redirect to login on `401` with session-expired notice.
- Wired CRUD operations to new backend per-item routes (KTA/TTA/users/departments/pics).
- Added loading state + form control lock to prevent double submit in:
  - Login
  - KTA submit
  - TTA submit
  - Task Process submit
  - User form
  - Department form
  - PIC form

### DevOps / Config

- Updated Render blueprint for safer persistence:
  - Added `healthCheckPath: /api/health`
  - Added `STORAGE_FILE_PATH=/var/data/storage.json`

### Docs / Ops

- Expanded API section and auth contract in README.
- Added quality-gate scripts in package.json:
  - `npm run check`
  - `npm run smoke`
- Added automated smoke test script.
- Added release checklist for deploy and handover.
- Added PR template file for future review consistency.

## Validation

- ✅ `npm run check`
- ✅ `npm run smoke`
- ✅ Auth guard verified (`401` on protected endpoint without token)

## Deployment Notes

For Render:

- Ensure env vars:
  - `HOST=0.0.0.0`
  - `DATA_DIR=/var/data`
  - `STORAGE_FILE_PATH=/var/data/storage.json`
  - `CORS_ALLOWED_ORIGINS` (required if frontend uses a different domain)
- Ensure persistent disk mounted at `/var/data`.

## Risk & Rollback

### Risks

- Existing sessions from old login flow may require users to re-login.
- Any external consumer that still uses old auth assumptions may fail until updated.

### Rollback Plan

- Revert this PR.
- Redeploy last successful build.
- Confirm health endpoint and login flow return to previous behavior.

## Reviewer Focus

- Confirm all protected endpoints correctly enforce bearer token.
- Confirm KTA/TTA + master-data CRUD works for create/update/delete from UI.
- Confirm 401 handling returns user to login with proper message.
- Confirm double-submit is prevented during slow requests.
