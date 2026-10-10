# Atlas delivery update

Latest follow-up: [ATLAS_REDESIGN.md](ATLAS_REDESIGN.md) documents the user's readability feedback and the repaired existing-account blank-page regression. The measurements below belong to this earlier delivery batch.

Date: 2026-10-10, Windows / Node 24.17.0. This supplements the original delivery report.

## A. Completed locally

- Brand homepage at `/`, Studio at `/studio`, module library at `/modules`, canvas at `/compose`. Existing runtime applications keep their own roots.
- 80 built-in module contracts: 10 foundations, 50 typed campus collections, 12 connectors, 8 display components. Real database CRUD, search, ownership and persistence are shared through one implementation. Definitions and limits: [VISUAL_MODULES.md](VISUAL_MODULES.md).
- Module search/category/domain filters, grid/list, per-module detail with local interactive examples, visual interfaces, fields, dependencies and installation. The local examples are labeled and do not claim backend writes.
- `+moduleId` / `+中文模块名` autocomplete, persistent job references and constrained module selection.
- Drag/connect/embed/configure/save/reload/build a real trusted local app without prompts. Verified notifications, embedded records, counts, views and search/status controls.
- Git-cloned Taste Skill after functionality acceptance; applied Finesse/Taste guidance to Atlas typography, NASA image layering, entrance/parallax, responsive hierarchy and product UI. Sources and exact commit: [ATLAS_DESIGN.md](ATLAS_DESIGN.md).
- 15 Node tests and 4 browser journeys pass; lint/typecheck/build, PostgreSQL verification, shared-source checks and advisory scan pass. Latest Lighthouse: 85 performance, 100 accessibility, 100 best practices. No user visual approval is claimed.
- Events, Marketplace, Study Buddy and the fourth canvas application are deployed as local trusted processes. All latest artifacts have the same current shared-source fingerprint. These are declarative/module assemblies, not live-model generated code.

Run `npm run dev`, wait for the ready URL, then `npm run deploy-local` and `npm run deploy-visual`. After source changes use `-- --redeploy`. Addresses are in `.data/local-running.json`, `.data/showcase.json`, `.data/visual-showcase.json`. Local account details remain private in `.data/local-access.json`. Never delete these data directories to restart.

## B. One-time user resources

| Priority | Resource | Minimum action | Configuration | Impact if absent |
| --- | --- | --- | --- | --- |
| P0 | Tool-capable LLM service | Put authorized key and model ID in local .env; never in chat | LLM_API_KEY, LLM_MODEL, optional LLM_BASE_URL | Live AI generation and repair remain BLOCKED |
| P0 | Docker Linux Engine | Install/start Docker Desktop and complete any required OS authorization/restart | DEPLOYMENT_PROVIDER, FOUNDRY_IMAGE | Untrusted custom code cannot run |
| P1 | Authorized host/domain | Supply access through local key management and configure DNS after deployment design is ready | APP_DOMAIN, PUBLIC_ORIGIN, COOKIE_SECURE | No public hosting or HTTPS acceptance |
| Optional | Email service | Configure dedicated SMTP credentials locally | EMAIL_PROVIDER, SMTP_URL, EMAIL_FROM | Local outbox only; no external delivery |

Detailed acquisition steps, alternatives and verification: [USER_ACTION_REQUIRED.md](USER_ACTION_REQUIRED.md). No new GitHub or map key is required for current functionality.

## C. Remaining engineering and limits

External-resource blockers are distinct from incomplete engineering: a dedicated isolated runner, dynamic TLS routing, hostile-tenant testing, arbitrary executable module extraction/signing/version execution, team sharing and production backup scheduling are not complete. The local process provider is not a sandbox. Live LLM custom feature generation has no real-provider acceptance yet; scripted-provider tests are explicitly contract tests.

Functional collection modules implement typed records and bounded workflows, not official school systems, payment processing or unrestricted third-party integrations. Lists cap at 200 rows; pagination UI is not yet implemented. Homepage mobile lab LCP is 3.8s and can improve further. Final visual taste remains for user review.

Failures and repairs, including the initial rate-limit browser failures and source-change backup refusal, are preserved in [../TEST_REPORT.md](../TEST_REPORT.md). No test was deleted or skipped to achieve a pass.

## D. Connected completion

After configuring resources, `npm run verify-integrations` checks connections; `npm run complete-connected` runs existing acceptance and real provider/runner checks and records PASS/FAIL/BLOCKED. Exit 2 indicates a blocked dependency. This command does not implement the remaining production engineering automatically. Resume through [../NEXT_ACTIONS.md](../NEXT_ACTIONS.md); the agent must inspect actual generated code and independently verify database/API/UI behavior before claiming final platform completion.
