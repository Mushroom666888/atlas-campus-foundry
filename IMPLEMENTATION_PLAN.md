# Implementation plan and acceptance ledger

Task states: TODO / IN_PROGRESS / TESTING / DONE / BLOCKED. Evidence: IMPLEMENTED / TESTED / DEPLOYED / BLOCKED / PLANNED.

| ID | Goal / dependency | Scope | Acceptance | State / result |
|---|---|---|---|---|
| R01 | Research / network | scripts/research, docs/research | Real sources, screening, taxonomy, license audit | DONE: 72 samples, 58 README; no full-code audit claimed |
| A01 | Architecture / R01 | contracts, SQL, ARCHITECTURE | Executable contracts and separate storage | DONE: build and migration tests |
| C01 | Control plane / A01 | server | Accounts, owner checks, projects, logs, audit | DONE: API and browser tests |
| M01 | Modules / C01 | packages/modules | 10 real reusable capabilities | DONE: runtime, API and E2E tests |
| G01 | Agent tools / M01 | agent/executor | Scoped real tools, files, bounded loop and durable state | DONE: contract-provider tests, not live LLM |
| G02 | Live generation / G01, credentials, Docker | generated projects | Model-generated custom code, build, tests, repair and preview | BLOCKED: missing live resources |
| U01 | Studio / C01,M01 | web | Functional Chinese UI, desktop/mobile | DONE: Playwright |
| D01 | Trusted local hosting / M01 | deployment/runtime | HTTP, persistence, lifecycle, health, logs | DONE: actual processes and three apps |
| D02 | Untrusted isolation / Docker | executor, image, runner, ingress | Container containment and real isolation tests | BLOCKED: no Docker; dedicated runner and ingress still unfinished |
| V01 | Three products / U01,D01 | showcase/tests | Events, Marketplace, Study Buddy, shared provenance | DONE: deterministic assembly; per-app databases |
| V02 | Non-prebuilt AI feature / G02 | actual generated output | Independent database/API/UI acceptance | BLOCKED: built-in waitlist does not satisfy this criterion |
| E01 | Supported policy loop / V01 | registry | Extract, review, publish, install, update, rollback, use | DONE: actual independent-app FIFO membership behavior |
| E02 | General code modules / G02,D02 | packaging | Arbitrary code extraction and isolated reuse | TODO / PLANNED |
| Q01 | Security / implemented areas | tests/reports | Auth, CSRF, traversal, upload, chat, vault review | DONE locally; production limitations remain |
| Q02 | DB and crash recovery / D01 | scripts | Native PostgreSQL and abrupt process restart | DONE: PostgreSQL 18.4 and IPC shutdown/recovery |
| Q03 | Local backup and storage ownership / Q02 | server/backup, storage-lock, scripts, tests | Offline complete snapshot, fresh-root restore, real HTTP/data/secrets/media, stalled-process exclusion | DONE: two backup/lock tests included in the 8-test suite |
| H01 | Delivery/recovery / all above | scripts/docs/Git | Startup, evidence, resources and resumable state | DONE locally |
| P201 | Production / D02 | runner, TLS, offsite backup schedules | Public hosting and hostile-tenant acceptance | TODO / PLANNED |

Team collaboration and cross-app sharing have schema only. They are not enabled. External blockers are separate from independently completed local work.
