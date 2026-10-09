# Resume here

1. Read PROJECT_STATUS.md, TEST_REPORT.md, SECURITY_REPORT.md and docs/USER_ACTION_REQUIRED.md. Inspect git status and artifacts/acceptance/results.json.
2. Read .data/local-running.json and .data/showcase.json for live addresses. Credentials are only in .data/local-access.json. Preserve all databases, artifacts and revisions.
3. For restart: npm run dev, then npm run deploy-local. The startup script picks a free local port. App links use distinct app-<uuid>.localhost hosts.
4. After secure configuration, run npm run verify-integrations. Exit 2 is BLOCKED. SMTP is optional; local PostgreSQL needs no external credentials.
5. When Docker exists, build the runner image and run npm run verify-docker. Finish independent runner and domain isolation before enabling generated-code deployment; do not bypass gates.
6. Run npm run verify-live-agent against the actual model. Inspect files and tool events, then add independent API/UI assertions against its actual generated custom feature. The built-in waitlist recipe is not model-generation evidence.
7. Implement general executable module extraction/signing and true code-version execution, then repeat independent fourth-app reuse with extracted executable code.
8. Finish HTTPS routing, offsite backup scheduling, PostgreSQL/container-native recovery and hostile-tenant tests before public operation. Local offline PGlite snapshots and fresh-root restoration are tested; see docs/OPERATIONS.md and npm run verify-backup.

No work is claimed to execute automatically after this session ends.
