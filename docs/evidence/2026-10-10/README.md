# Local acceptance evidence

Captured on 2026-10-10 Asia/Shanghai against implementation checkpoint `ecb8e00` on Windows, Node 24.17.0. JSON timestamps are UTC. These files are copies of actual command outputs, not expected-result fixtures.

- `acceptance-results.json`: seven local commands TESTED; external integrations, Docker and live Agent commands BLOCKED, each returning 2. No local FAILED result.
- `test.txt`: eight tests passed, zero failed/skipped; includes actual process deployment and offline backup restoration.
- `browser.txt`: one complete Playwright journey passed, exercising Studio and three applications.
- `postgres-results.json`: native PostgreSQL 18.4 migrations, SCRAM and database-server restart persistence.
- `recovery-results.json`: abrupt control exit, runtime shutdown and persistent state reconciliation.
- `backup-results.json`: fresh-directory restore, real HTTP/data/media/session/secret recovery and defensive rejection checks.
- `reuse-report.json`: three applications reference the same shared source. This proves deterministic composition provenance, not LLM generation.
- PNGs: actual Playwright desktop Studio and mobile Study Buddy screenshots.

Additional executed checks: dependency audit reported zero advisories; the actual local three-app data snapshot contained 4,274 files (162,217,029 bytes), and CLI verification succeeded. Duplicate startup was refused without changing the active Studio address. Live services returned HTTP 200 and the expected application identities after restart.

The sensitive snapshot remains ignored at `.backups/pre-delivery-20261010`. Credentials, vault keys and databases are not part of these tracked evidence files. Complete logs/screenshots and historical failure traces remain in ignored `artifacts/`; see TEST_REPORT.md for failure explanations.

This evidence does not establish live LLM generation, Docker containment, public deployment or production safety.
