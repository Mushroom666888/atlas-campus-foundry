# Requirements audit - 2026-10-12

Source: user attachment `Pasted text.txt`, titled AI-Native Modular Campus Application Development Platform. Existing working code and user data are preserved. Historical October 10 test results are not new verification.

| ID | Requirement / actual gap | Dependencies | Scope | Acceptance | Status / evidence |
|---|---|---|---|---|---|
| RA01 | Structured product requirements | Existing contracts, project update, Agent | requirements.ts, requirements-editor.tsx, Agent | Editable roles, models, relationships and acceptance scenarios persist; invalid references fail; Canvas retains them | DONE / TESTED: requirements-workspace.test.ts, requirements.browser.spec.ts |
| RA02 | Professional source collaboration and recovery | Scoped files and audit | projects.ts, file-history.tsx, Agent | Conditional save rejects stale edits; owner-only history/restore; complete hashes on paged Agent reads; partial failure invalidates prior validation | DONE / TESTED: workspace, Agent, browser and independent review |
| RA03 | Relational campus domain | Runtime migration 005, campus module | campus.ts backend/contracts, campus-domain.tsx | University/campus/building/venue/course/club; private student affiliations; event venue linkage; permissions, mismatches, pagination and restart | DONE / TESTED / DEPLOYED locally: PGlite, PostgreSQL 18.4, browser |
| RA04 | Module registry, composition, search/filter/detail, frontend/backend reuse | Existing implementation | Regression tests | Preserve contracts and validated Canvas; no placeholder module count | TESTED: 28 Node tests, 12 browser journeys, five sample source fingerprints |
| RA05 | Real LLM-generated custom feature and self-repair | LLM credentials and isolated runner | Existing provider/tools/live acceptance | Actual model generates tested feature, no scripted result claimed as live AI | BLOCKED: model not configured |
| RA06 | Isolated builds and public managed hosting | Docker, dedicated runner, authorized host, TLS | Deployment platform | Container isolation and hostile tenant review, real HTTPS ingress | BLOCKED externally; dedicated runner/ingress engineering remains TODO |
| RA07 | General executable module ecosystem | RA06, signing/versioned runtime | Registry/executor | Extract arbitrary code and install independently with tests | TODO; current tested ecosystem is declarative FIFO policy only |
| RA08 | Team collaboration and explicit cross-app service contracts | Authorization design and APIs | Control plane | Invite/revoke/roles and audited data contracts | TODO; schema alone is not implementation |
| RA09 | Commercial/community operational scale | Pagination/moderation/online payment provider | Shared modules | Moderation, scalable histories and provider verification | TODO; offline commerce and community already implemented |

Evidence: `docs/evidence/2026-10-12-requirements/`. RA01 describes intent; it does not execute user-defined data models, grant the described roles or automatically pass their scenarios. RA03 is a real relational runtime implementation, reusing application accounts, not platform identities. Legacy generic school/location/course records are preserved and are not automatically reclassified. Mapping existing records into the new canonical domain requires explicit selection to avoid guessing school identities. Course-specific group membership rules remain application logic.

This increment does not claim all requirements or the whole platform are complete. External resources are consolidated in `docs/USER_ACTION_REQUIRED.md`; unfinished runner, team and executable-module engineering is the developer's work, not a request that the user fix code. The minimal homepage remains unchanged.
