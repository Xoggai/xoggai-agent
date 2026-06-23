# Backup And Recovery

## Backup

Install PostgreSQL client tools so `pg_dump` is available, then set the Render
PostgreSQL connection string locally without committing it:

```powershell
$env:DATABASE_URL='<Render external PostgreSQL URL>'
npm run backup:database
```

The command creates a custom-format dump under `backups/`. The directory is
gitignored. Store the dump in encrypted storage with restricted access.

Recommended schedule:

- daily during public beta
- before schema changes
- before enabling any payment-adjacent feature
- retain seven daily and four weekly backups

## Restore Drill

Never test a restore against production.

1. Create an empty temporary PostgreSQL database.
2. Restore:

```powershell
pg_restore --clean --if-exists --no-owner --no-privileges `
  --dbname '<temporary database URL>' backups/xoggai-<timestamp>.dump
```

3. Point a local backend instance at the temporary database.
4. Run migrations and confirm `/ready` is healthy.
5. Verify counts for users, API keys, sessions, requests, audit events,
   endpoints, and execution tickets.
6. Delete the temporary database after recording the drill result.

## Recovery Priorities

1. Preserve audit and execution-ticket records.
2. Restore user/account state.
3. Restore endpoint catalog and routing history.
4. Revoke all sessions if backup age or credential integrity is uncertain.
5. Keep `OPERATIONS_KILL_SWITCH=true` until consistency checks pass.

Backup files contain sensitive operational and account data. Do not upload them
to GitHub, chat, public storage, or issue trackers.
