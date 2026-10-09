# Test report

Date: 2026-10-10 (Asia/Shanghai). Platform: Windows, Node 24.17.0, npm 11.13.0. Other operating systems are not claimed as validated.

## Executed checks

| Command | Result | Evidence / scope |
|---|---|---|
| npm run lint | PASS | ESLint, no remaining errors |
| npm run typecheck | PASS | TypeScript strict checking |
| npm run build | PASS | Production Vite bundle and type check |
| npm test | PASS: 8 tests, 0 failed, 0 skipped | Manifest/resolver, real PGlite runtime, control/registry, scripted-provider Agent tools, actual local deployment, SSE revocation/shutdown, backup restoration and stalled-process storage ownership |
| npm run e2e | PASS: 1 comprehensive browser journey | Studio creates and deploys three products; events/notifications, images/search, two-party live SSE chat, study groups/profiles, module install, durable BLOCKED job, desktop/mobile layouts |
| npm run verify-postgres | PASS | Native PostgreSQL 18.4, SCRAM, both migrations, idempotence, registration, event enrollment and full database-server restart |
| npm run verify-recovery | PASS | Abrupt control-process exit, app IPC disconnect shutdown, persistent control session/project and interrupted deployment reconciliation |
| npm run verify-backup (also included in npm test) | PASS | Offline snapshot, empty directories, restored accounts/data/images/secrets/revisions, relocated artifact HTTP restart; live/remote/container storage refusal, checksum/traversal rejection; stalled child cannot lose its lock |
| npm run reuse-report | PASS for local showcase | Three apps use identical shared module source; per-app module lock, one shared implementation; custom executable lines are 0 for deterministic showcase apps |
| npm audit --audit-level=moderate | PASS: 0 reported advisories | Dependency advisory check, not a security certification |
| npm run verify-integrations | BLOCKED | No LLM/Docker/SMTP configuration; native PostgreSQL local alternative verified |
| npm run verify-docker | BLOCKED | Docker Engine unavailable; no host execution fallback |
| npm run verify-live-agent | BLOCKED | No real model and reviewed isolated deployment |

Exact latest exit codes and individual command logs are in artifacts/acceptance/results.json and artifacts/acceptance/*.log. The combined connected workflow returns exit 2 when integrations are blocked; that is not full-platform success.

Tracked evidence snapshot: docs/evidence/2026-10-10/. The actual local data backup was verified (4,274 files, 162,217,029 bytes), then all three applications returned HTTP 200 after restart. Duplicate Studio startup was refused without overwriting the running-address metadata.

## Covered behavior

Actual SQL read/write, transaction rollback, enrollment capacity/FIFO promotion, notifications, profile/course/place/school records, topic search, parameterized SQL-injection probes, ownership denial, private-conversation authorization, cross-app session denial, CSRF Origin rejection, invalid image rejection, valid image re-encoding, encrypted variables and reserved-key/newline rejection, path traversal and secret-file denial, module owner/admin checks, pending-module rejection, dependency order/cycle/version checks, extension install/update/rollback, immutable deployment recipe rollback and restart persistence.

The independent reuse test executes the extracted policy in a fourth application's database without copying the source project's policy file. This establishes restricted declarative reuse, not arbitrary code extraction or live AI generation.

The Agent test Provider is explicitly scripted. It exercises real tools and storage, verifies failure budgets and invalidated previews, and is not presented as a real LLM integration test.

## Failures encountered and repaired

- PowerShell Invoke-WebRequest failed in this environment; Node fetch successfully accessed GitHub APIs.
- Initial GitHub searches included irrelevant README matches; 35 records were excluded and reasons retained. Raw-content timeouts were worked around with the API. Rate-limit and missing-README errors remain labeled in repository metadata.
- Official OpenAI documentation endpoints returned HTTP 403. No claim of successful retrieval was made.
- Initial TypeScript generic SQL typing and CSS module declaration failures were fixed; build now passes.
- Initial Playwright launch lacked its Chromium revision; npx playwright install chromium installed the required browser.
- First upload fixture was a malformed PNG. Sharp rejected it correctly (vipspng/libpng read error). Replaced it with a generated valid PNG while retaining the invalid-image security test. Failure trace and screenshots are in artifacts/failures/browser-upload/.
- Independent review identified stale validation flags, incomplete rollback, dependency-order behavior, unused secret storage, custom loader gaps and process recovery. Fixes and blocked security boundaries are recorded in docs/INDEPENDENT_REVIEW.md.
- Native PostgreSQL launcher exposed Windows inherited-pipe waiting behavior. Command lifecycle handling was repaired; actual native server acceptance now passes.
- A syntax error while adding output contracts was caught by typecheck/lint, corrected, and followed by passing regression tests.
- First offline restore omitted empty PostgreSQL directories and failed initialization. The manifest now includes directories, followed by a real restored application HTTP test. The original failure is retained in artifacts/failures/backup/.
- A stale-timeout file lease was rejected during independent review. Kernel-owned local endpoints now retain ownership while a child is unresponsive for 11 seconds and release on actual process death. Linux behavior remains untested; container file snapshots are refused.
- Restoring terminal deployment statuses was corrected and asserted for failed/deleted/stopped records; only active records become interrupted. An old interrupted-status expectation was updated to assert this corrected requirement.

No failing test was deleted or skipped to obtain a pass. No live model, container, external email delivery, public HTTPS route or arbitrary generated custom feature has been reported as tested.
