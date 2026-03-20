## Summary

This PR upgrades the WBS app into a stricter frontend-backend flow with token-based API access, adds full CRUD endpoints for core entities, improves submit UX reliability, and adds release/verification guardrails for safer deployment.

It also updates the daily target composition for job groups `PENGAWAS` and `LEVEL 1 MGT` from `2 KTA + 1 TTA` to `1 KTA + 2 TTA` in both calculation logic and dashboard target labels.

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
- Updated job-group target logic for `PENGAWAS` and `LEVEL 1 MGT`:
  - KTA target/day: `2` -> `1`
  - TTA target/day: `1` -> `2`
  - Dashboard target basis text: `KTA 2 + TTA 1 / hari` -> `KTA 1 + TTA 2 / hari`

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

## Recent Updates (Mobile UI & Access Control)

### Frontend - Mobile UX Improvements

- Improved KTA/TTA history layout for mobile with responsive card-style table rendering:
  - Header row hidden on mobile (≤768px)
  - Each record displays as a card with label-value pairs
  - Status field now uses visual badge indicator
  - Action buttons (Detail, Edit, Delete) wrap responsively in container
  
- Enhanced KTA/TTA detail panel structure:
  - Separated title and record ID for clearer visual hierarchy
  - Grouped information into visual cards per field
  - Added section titles for Detail Temuan, Tindakan Perbaikan, and photo galleries
  - Photo grid adapted for mobile (2-column on small screens)
  - Applied consistent status badge styling

- Reorganized KTA/TTA form inputs into clear sections:
  - **Informasi Pelapor**: Auto-filled readonly fields (No ID, Date, Name, Jabatan, Dept, Perusahaan)
  - **Detail Temuan**: Investigative data (Tanggal, Jam, Kategori, Lokasi, Risk Level, PIC, Pelaku TTA, Detail Temuan, Foto Temuan)
  - **Tindak Lanjut**: Action selection (Perbaikan Langsung)
  - **Detail Perbaikan**: Conditional section (Tindakan Perbaikan, Foto Perbaikan, Tanggal Perbaikan, Status) - appears only if Perbaikan Langsung = Ya
  - Each section has explanatory subtitle for context
  - Fields on mobile collapse to single column

### Backend - Access Control Enforcement

- Added role-based access control for TTA deletion:
  - New helper function `isSuperAdminAccount()` validates Super Admin status from token
  - `DELETE /api/tta/:noId` endpoint now requires Super Admin, returns `403 Forbidden` for non-superadmins
  - Auth middleware attaches user account info to `req.auth` for downstream checks
  
### Frontend - Permission Guard

- TTA history history rendering now conditionally shows Delete button only for Super Admin users
- Client-side validation prevents delete click handler from executing for non-superadmins
- Error message clearly indicates "Hanya Super Admin yang dapat menghapus tiket TTA."

### Styling Enhancements

- New `.form-section` class for mobile-friendly form grouping (card layout, gradient background, shadow)
- Updated `.btn-small` to use flexbox centering for better alignment
- Added `.table-actions` wrapper for responsive button grouping in table cells
- Status badge colors:
  - `status-open`: Blue (#eff6ff background)
  - `status-progress`: Orange (#fff7ed background)
  - `status-close`: Green (#ecfdf5 background)
  - `status-empty`: Gray (#f8fafc background)
- Readonly inputs styled with dashed borders and light background for visual distinction
- File inputs styled with consistent background and padding

## Validation

- ✅ `npm run check`
- ✅ `npm run smoke`
- ✅ Auth guard verified (`401` on protected endpoint without token)
- ✅ TTA endpoint delete access verified (403 for non-superadmin)
- ✅ Frontend TTA history renders delete button only for Super Admin
- ✅ Mobile card layout renders correctly (verified via CSS media queries)
- ✅ Form sections group logically (verified via semantic structure)

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
- Confirm dashboard target numbers for `PENGAWAS` and `LEVEL 1 MGT` follow `1 KTA + 2 TTA / hari`.
