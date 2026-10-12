# Campus AI App Foundry architecture

## Requirements and source integrity (2026-10-12)

ProductSpec optionally carries bounded roles, typed data models, model references and Given/When/Then scenarios with module traceability. Optionality keeps existing JSON specifications compatible. Duplicate keys and missing role/model references are rejected; module updates cannot leave scenarios pointing to uninstalled modules. `/api/projects/:id/requirements` distinguishes incomplete versus specified intent, and scenarios remain `NOT_RUN`. These specifications are planning contracts, not executable migrations or proof that arbitrary business requirements work. Canvas preserves the specification, app kind and theme during visual editing.

Human file PUT and Agent write tools require `expectedHash`: null only creates a new file, otherwise SHA-256 must match. A per-project single-process queue serializes quota/preflight/compare/write. Atomic file replacement avoids partial bytes. Restore writes a new revision and never removes old history; ownership is checked before reading revisions. `product.json` is managed through project/Canvas updates. Empty path segments, traversal, symlinks and case variants of reserved directories are rejected. This is not a multi-worker distributed lock or a transaction spanning database and filesystem.

Agent reads return an 8,000-character page with whole-file hash, offset, nextOffset and totalChars. Large other tool results become valid JSON summaries, with complete results in durable events. Mutation tools invalidate previous build/test/preview evidence before execution. If a multi-file operation partially fails, prior writes are retained, individually audited and listed in its error; the task must validate again and cannot report its stale preview as success.

## Relational campus runtime

Migration `runtime/005_campus_domain.sql` adds universities, campuses, buildings, venues, courses, clubs, student affiliations and event links. Compound foreign keys enforce university/campus/building/venue ownership relationships even for direct SQL. Domain services reuse each app's account and event tables. A student may have several self-declared affiliations; only their own account can read or change them. These affiliations do not establish official student verification.

The `campus` module exposes `/api/campus/contracts`, paginated `/api/campus/:collection`, owner-managed CRUD, `/api/campus/me/affiliations` and owner-managed `/api/campus/events/:id/location`. Runtime users see readable directory, relationship forms, event venue and real OpenStreetMap links for supplied coordinates. Only university record owners or app administrators maintain its directory; individual event owners select their event location. Links are metadata, not verified venue reservations or club endorsement. School-level locks enforce per-school collection quotas; account locks enforce university and affiliation quotas. Removing a referenced parent fails with 409, preserving references.

Existing generic school/location/course data remains unchanged for compatibility. New relational records are canonical for these APIs; no guessed backfill or cross-application sharing is performed. Module count stays at 94. Shared runtime exports automatically include these contracts, services and migrations.

## Components

- `web/`: Chinese/English Developer Studio and shared runtime UI; React/Vite static bundle with persistent i18next language choice.
- `server/control.ts`: Fastify control plane, identity, projects, registry, durable jobs, audit and deployment records.
- `server/agent.ts`: interchangeable LLM provider, tool schemas, bounded validation/repair loop. Chat Completions compatible protocol; actual provider verification requires credentials. Official documentation fetches were blocked by HTTP 403 in this environment.
- `packages/contracts`: machine-readable Zod module and product specifications.
- `packages/modules`: one shared source for identity integration, profiles, campus, content, search, chat, notifications, events, groups, media.
- `server/runtime-*`: an independent application server with its own database and account sessions.
- `server/executor.ts`: Docker-only custom code compilation/test. Fixed argv, no shell interpolation.
- `server/deployment.ts`: artifact snapshots, health probes, local lifecycle and Docker adapter.

## Atlas module composition

The 94 built-in manifests comprise 10 commerce, 4 community, 10 base capabilities, 50 typed campus collections, 12 bounded connectors and 8 display modules. `business-catalog.ts` supplies per-domain fields/status/privacy; `records.ts` supplies shared SQL, authorization, search and CRUD. The collection modules are typed record workflows, not complete transaction engines. `commerce.ts` implements shop, product, stock, order, fulfillment, review, coupon, favorite, appointment and analytics contracts with transaction locks and ownership checks. `community.ts` implements public profiles, a member directory, forum discussions/replies and product showcases. Control and runtime mount that same implementation against their own databases and account sessions. All new migrations are additive.

`composition.ts` validates typed graph ports, installed targets, cycles, private-data flow and at most three embedded levels. Runtime actions use one transaction, a 160-step budget and no recursive event emission. Node/depth memoization bounds validation of dense graphs. `web/visual-builder.tsx` uses React Flow; saving updates the real project specification, and deployment snapshots the graph. Removing a module prunes dependent graph nodes; stale runtime configurations cannot write to an uninstalled target.

Version 2 graphs require a product description, explicit dependency nodes/edges and business inputs for connectors and presentation nodes. Dependency edges describe existing public interfaces rather than execute mutations. Four canvas lanes distinguish foundation, business, automation and presentation. Invalid edges are red and prevent save/deployment. A complete graph update validates the replacement graph and atomically commits application specification, project name and module installations, rather than validating a partially pruned old graph. Legacy version 1 graphs retain their earlier contract. Structure validation does not prove that freeform intent or arbitrary business rules are satisfied.

Commercial flows use integer-cent price snapshots, explicit expected-price consent, idempotent orders and locked inventory/coupon updates. Payments are offline only. Quota creation uses a transaction and per-owner advisory lock. Public community APIs expose opt-in profile fields, never account email/session/password. Runtime route gates enforce installed module dependencies. See `docs/COMMERCIAL_COMMUNITY.md` for workflows and limits.

The public Atlas homepage is `/`; authenticated tools are `/studio`, `/modules`, `/builder` and `/compose`. Runtime app routing remains independent. The homepage has no module list or catalog projection; navigation opens the module library. Studio/runtime/canvas bundles are lazy loaded; static responses support HTTP compression. Only matched GET `/assets/` routes bypass the API limiter. Module detail previews are explicitly local examples; deployed application views use authenticated APIs.

## Data boundaries

Platform accounts, teams, projects, applications, module installations, jobs, module releases and deployments live in the control database. Runtime accounts, schools, school membership, profiles, entities, messages, media and notifications live in a different database directory per app. The same email may register separately in several apps; there is no implicit cross-app identity or data access. School membership is self-declared, email verification is not university identity proof. Teams and cross-app grants currently have schema only; their collaborative/sharing workflows remain PLANNED. Project APIs enforce owner authorization.

PostgreSQL migrations are versioned and transactional. Local PGlite is PostgreSQL compiled to WASM with real disk storage, not an in-memory mock. The server adapter uses `pg` transactions and parameterized SQL. Windows native PostgreSQL 18.4 migrations and restart persistence are TESTED. Docker Compose remains untested.

## Module lifecycle

Manifest validates interfaces, configuration, permissions, dependencies, versions, migrations and review state. The registry resolves transitive dependencies, rejects cycles/version conflicts/pending releases and stores installations plus rollback history. Shared runtime tables use one versioned migration rather than module-created competing user tables. Uninstall removes activation but preserves user data. Declarative recipe publication requires an administrator and a restricted recipe schema. Arbitrary uploaded module code is not accepted for publication.

## Builder and agent

`mode=design` restricts the Agent to inspection, module discovery/dependency resolution, diagnosis and `proposeDesign`. It persists a schema-validated product plan without writing files, creating projects or deploying. Users open the product plan and refine it before saving an application. The tool contract and persistence are tested with an explicitly scripted provider; actual LLM output awaits a configured provider. The normal development mode retains controlled real project/build/test tools.

Explicit module assembly creates product.json, package.json, tsconfig and source workspace; this is not represented as AI generation. Real model tasks persist input, plan, tool arguments/results, files, failures and final status. Model/tool budgets cap work. File operations are scoped to owner workspace, deny traversal/symlinks/secrets and impose quotas. Untrusted README or module metadata cannot grant tool privileges. Freeform TypeScript is stored but only compiled/tested/executed in Docker. Without credentials, a job is durably BLOCKED, never mocked as successful.

## Deployment and recovery

Project lifecycle migration `control/003_project_lifecycle.sql` adds reversible deletion. Normal project and deployment lists exclude trashed projects. Archive marks the project unavailable, cancels its jobs and stops active instances under the application lock; errors restore its active status. Restore uses the same lock and leaves processes stopped. Per-account row locks serialize creation/restoration against the 20-active/100-retained quotas. Files, application databases, encrypted configuration and deployment history remain available after restoration. These are single-control-process lifecycle locks, not a distributed-worker lease.

`server/export.ts` creates an owner-only ZIP from an explicit shared-runtime source allowlist and a bounded project workspace. It omits databases, platform accounts, environment files and control services. The standalone entry reads product/modules/recipes, runs the real runtime and stores fresh data under `app-data`; Compose uses a named volume. Custom workspace sources are included but never automatically loaded. Checksums support artifact inspection, not publisher authenticity. Independent local install/start/restart is tested; cloud/Docker deployment remains unverified.

Local-trusted mode starts ONLY shipped runtime source in an independent process with sanitized environment and per-app data directory. It is for the local machine owner, not a public multi-tenant security boundary. Any project containing executable custom code is rejected. Health checks use an actual HTTP endpoint and database query. Artifacts record module versions and a SHA-256 of shared source. Stops retain data. Restart and rollback start a new revision; rollback is application revision recovery, not destructive database downgrade. Control restart marks active jobs/deployments interrupted.

Docker mode uses read-only root, explicit data/config/workspace mounts, an internal per-app network, non-root user, CPU/memory/PID limits, no capabilities and no-new-privileges. Build has no network and no provider credentials. Host Docker access remains privileged and requires a dedicated runner service before exposing the control plane to untrusted developers. Production requires HTTPS ingress, authenticated routing, OS-level tenant enforcement, PostgreSQL roles/RLS review, backup/restore tests, signed images, secret rotation and operational review. Those are not implied by local checks.

## Expansion

Local embedded database ownership uses an OS endpoint keyed by canonical directory: Windows named pipe (TESTED), Linux abstract socket (IMPLEMENTED only). Ownership is released by the kernel on process death; unresponsive processes do not lose it to timeout. This prevents accidental same-host concurrent use, not cross-container or network-filesystem writers. Offline backups require all local locks, preserve file/directory manifests and hashes, reject unsupported storage, and restore to a fresh directory with relocated artifacts. External PostgreSQL/container-native and offsite scheduled backups remain separate engineering work.

Move durable job claims to leased workers, deploy behind a dedicated runner API, use per-app database credentials and signed immutable module artifacts, then add collaborative team authorization and explicitly audited cross-app contracts. No Kubernetes requirement for the first server.
