## Summary

- 

## What Changed

### Backend

- 

### Frontend

- 

### DevOps / Config

- 

### Docs

- 

## Validation

- [ ] `npm run check`
- [ ] `npm run smoke`
- [ ] Manual login test
- [ ] Manual submit KTA test
- [ ] Manual submit TTA test
- [ ] Manual task process update test
- [ ] Verify 401 auto-logout behavior

## Deployment Notes

- [ ] Render env var `HOST=0.0.0.0`
- [ ] Render env var `DATA_DIR=/var/data`
- [ ] Render env var `STORAGE_FILE_PATH=/var/data/storage.json`
- [ ] Render env var `CORS_ALLOWED_ORIGINS` (if frontend is separate domain)
- [ ] Persistent disk mounted at `/var/data`

## Risk & Rollback

### Risks

- 

### Rollback Plan

- Revert PR
- Redeploy previous successful release

## Checklist

- [ ] Scope matches requirement
- [ ] No unrelated file changes
- [ ] No secrets/credentials included
- [ ] README/ops docs updated if needed
