# Resume here

## Current handoff - 2026-10-12

Read `docs/REQUIREMENTS_DELIVERY.md`, `docs/REQUIREMENTS_AUDIT.md` and `docs/evidence/2026-10-12-requirements/` first. Requirements, expected-hash source/history, and a relational campus runtime have been added without replacing user databases. New migration: runtime/005. No further user confirmation is required for routine development.

The latest user request was full-stack verification and frontend improvement. Full `npm run check` passed 28 Node tests, full E2E passed 12 journeys; after final shared layer placement changes, four affected Node tests and six browser journeys passed again. Native PostgreSQL 18.4 passed migration/restart/quotas earlier in this same increment. Audit: 69 existing-account route/viewport checks; 685 translation keys complete; production npm audit reports zero known advisories. Retained UI regression failures and fixes are documented in TEST_REPORT.md. Raw authenticated traces remain ignored.

The technical graph now mounts only when visible and defaults to readable zoom. Do not restore automatic fit-all on entering the view. Its pannable minimap has a reserved footer so it does not intercept node gestures. `compositionLayer` is shared by Agent design and Canvas. Old projects without a graph get lane placement and dependency edges; existing user positions are preserved. Product roles/models/scenarios describe intent, not executed migrations/RBAC; scenario readiness stays NOT_RUN.

Studio remains http://127.0.0.1:3000, restarted with the final sources; wrapper PID at handoff was 30540 (verify before using). Five sample applications were redeployed and share current source. Use metadata files for current ephemeral ports. The minimal homepage remains unchanged. Fonts use real system CJK weights, with 16px form text. No visual user approval is implied.

Unfinished work: live model/custom-feature validation, Docker isolation, dedicated runner/TLS ingress, executable-module publication and multi-version execution, team/cross-app authorization, commercial pagination/moderation/online payments. Do not mistake these for completed features or only missing credentials. Model connection was explicitly deferred by the user. Continue independent engineering without asking for that key again.

The following October 10 notes are historical. Their automatic fitView advice and older test counts are superseded above.

## Previous handoff

Read `docs/FOLLOWUP_DELIVERY.md` and `docs/evidence/2026-10-10-followup/` first. The latest user request removes the whole homepage module recommendation area; retain the simple Atlas scene and route module discovery to `/modules`. Do not restore the deleted section. Project deletion/restore, owner ZIP export, bilingual UI and idea-first Canvas are implemented. Local Studio remains http://127.0.0.1:3000; credentials/data stay in ignored `.data` files.

Current checks: 25 Node tests, 10 full browser journeys plus 7 final relevant regression journeys, 69 live existing-account route/viewport checks, native PostgreSQL row-lock quota race, and independent exported-app install/HTTP/restart. The initial export/browser failures are retained in evidence. Canvas now waits for registry/project/draft loading before accepting input, and fits nodes after the technical view becomes visible. Do not remove these guards.

Design tasks use `mode=design`, a restricted tool allowlist and persisted `proposeDesign` results. Missing model configuration is BLOCKED. ZIP export starts the shipped shared runtime independently with fresh accounts/data; arbitrary workspace code is included for review but not automatically executed. Docker/cloud definitions are IMPLEMENTED only. Export is not a data backup. Trash is reversible, not permanent erasure. Restore keeps deployments stopped; quotas are 20 active / 100 retained per account.

The remaining external/production work below is unchanged. No further language/homepage/deletion confirmation is needed. For configured integrations use the existing `npm run complete-connected` entry point; never claim it completes unfinished runner/ingress engineering automatically.

## Earlier release context

Latest work is the 94-module commercial/community release: read `docs/COMMERCIAL_COMMUNITY.md` and `docs/evidence/2026-10-10-commerce/` first. Current check is 21 Node tests / 7 browser journeys; native PostgreSQL verifies new migrations, concurrent orders and community persistence. Community is shared between Atlas and installed runtime apps. Canvas v2 requires product description, wired dependencies and valid inputs; it is not a live AI understanding test. Preserve version 1 compatibility and replacement-graph save regression. New showcase metadata: `.data/commercial-showcase.json`; `npm run deploy-commerce -- --redeploy` refreshes its source.

`npm run reuse-report -- --showcase` validates the 5 declared sample apps. The unscoped historical report also contains another account's old application and currently returns failure for its older source. Do not bypass ownership or rewrite its project to make a report green. `scripts/audit-studio.ts` now includes 23 existing-account routes at three widths and deliberately paces requests to respect the live API limit. It requires commercial showcase setup.

Latest user feedback and repair: `docs/ATLAS_REDESIGN.md`. Do not restore the foreground image mask or tiny UI type. Registry reads must apply schema defaults to old published manifests; new-account-only tests missed this once. The live-account audit script verifies the actual older dataset. Current frontend asset handler serves new builds dynamically and sets no-store on the app shell; stale removed chunks receive a real 404 and a recoverable UI.

1. Read PROJECT_STATUS.md, TEST_REPORT.md, SECURITY_REPORT.md and docs/USER_ACTION_REQUIRED.md. Inspect git status and artifacts/acceptance/results.json.
2. Read .data/local-running.json, .data/showcase.json and .data/visual-showcase.json for live addresses. Credentials are only in .data/local-access.json. Preserve all databases, artifacts and revisions. Latest Atlas evidence: docs/evidence/2026-10-10-atlas/. The older acceptance/results.json is historical.
3. For restart: npm run dev, wait for the ready URL, then npm run deploy-local and npm run deploy-visual. The startup script picks a free local port. App links use distinct app-<uuid>.localhost hosts. After source updates, use -- --redeploy on both deployment commands. Keep source stable during fingerprint/backup tests. Restart the server after rebuilding hashed frontend bundles.
4. After secure configuration, run npm run verify-integrations. Exit 2 is BLOCKED. SMTP is optional; local PostgreSQL needs no external credentials.
5. When Docker exists, build the runner image and run npm run verify-docker. Finish independent runner and domain isolation before enabling generated-code deployment; do not bypass gates.
6. Run npm run verify-live-agent against the actual model. Inspect files and tool events, then add independent API/UI assertions against its actual generated custom feature. The built-in waitlist recipe is not model-generation evidence.
7. Implement general executable module extraction/signing and true code-version execution, then repeat independent fourth-app reuse with extracted executable code.
8. Finish HTTPS routing, offsite backup scheduling, PostgreSQL/container-native recovery and hostile-tenant tests before public operation. Local offline PGlite snapshots and fresh-root restoration are tested; see docs/OPERATIONS.md and npm run verify-backup.

No work is claimed to execute automatically after this session ends.

The original 80 contracts are preserved, with 10 commercial and 4 community additions. Details, +references, declarative canvas and earlier Atlas/Taste pass are implemented and tested. Do not rebuild them from scratch. Historical homepage performance lab result is 85/100 (LCP 3.8s); it was not remeasured for this release. User has not approved the final visual design. Remaining work includes full commerce/collection pagination, community abuse reporting/moderation and genuine online payment integration; none should be represented by empty catalog entries.
