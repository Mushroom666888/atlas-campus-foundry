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
| M02 | 80 module catalog / M01 | contracts, business catalog, records SQL/UI | 10+50+12+8 manifests; all 50 collections real CRUD/search/privacy/restart | DONE: contract and integration tests |
| U02 | Module explorer / M02 | module-studio, foundation-preview | Search/filter, detail, local preview, API graph, install, +references | DONE: browser and Agent tool tests |
| U03 | Zero-prompt builder / M02,D01 | composition, visual-builder, deployment | Drag/connect/configure/save/reload/deploy; notifications and embedded records | DONE: real browser workflow and fourth local app |
| Q04 | Graph security / U03 | composition, projects, records, tests | Private-data boundary, uninstall consistency, atomic save, bounded graph validation | DONE: independent review fixes and regression tests |
| U04 | Atlas design / U02,U03 | homepage, global brand styling, assets | Finesse/Taste audit, local type, real imagery, responsive navigation and motion | DONE: 9 viewports; Lighthouse 85 performance, 100 accessibility, 100 best practices |
| Q05 | Frontend delivery / U04 | HTTP compression, auth, homepage projection | Static assets do not exhaust API budget, API remains limited, lighter mobile images | DONE: rate-limit regression, build, browser and Lighthouse |
| U05 | Readability and existing-data repair / U04,Q05 | registry, HTTP, typography, homepage, canvas | Old published modules open normally; unobscured wordmark; readable type; fresh assets after build; recovery UI | DONE: 16 Node tests, 4 browser journeys, 42 existing-account viewport checks |
| M03 | Commercial modules / M02,D01 | commerce contracts, catalog, SQL, runtime and UI | Stock/order price/idempotency/fulfillment/review/coupon/booking transactions and multiuser browser flow | DONE: 10 real modules, integration/E2E/native PostgreSQL tests; offline settlement only |
| M04 | Reusable community / M02 | shared community backend/frontend; control/runtime migrations | Editable public profiles, school/bio/tags, directory, forum/replies, product showcase and separate app data | DONE: 4 real modules, persistence/privacy/ownership/install-gate/browser tests |
| U06 | Guided Canvas / U03,M03,M04 | graph contracts, projects and visual builder | Required description, visible dependencies, layers, invalid red links, save rejection and valid branch replacement | DONE: contract, real database and handle-drag browser tests |
| U07 | Motion and module comprehension / U04,M03,M04 | homepage, module details and previews | Subtle image movement with offscreen/reduced-motion controls; commercial and community previews/API explanations | DONE: browser/screenshot checks; examples explicitly separated from persistent app data |
| D03 | Commercial local showcase / M03,M04,U06 | deployment script and reuse report | Real healthy app with shared modules; same current source for declared samples | DONE: 5 declared showcase apps share source; unrelated historical app remains outside this acceptance scope |
| P201 | Production / D02 | runner, TLS, offsite backup schedules | Public hosting and hostile-tenant acceptance | TODO / PLANNED |

Team collaboration and cross-app sharing have schema only. They are not enabled. External blockers are separate from independently completed local work. Current suite: 21 Node tests and 7 browser journeys, with 2 additional community/Canvas reruns after screenshot-readiness correction. Earlier row counts refer to their original acceptance.
