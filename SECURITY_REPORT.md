# Security report

Final 2026-10-12 production dependency audit (`npm audit --omit=dev`) reports zero known advisories. The full local suite again passed 28 Node and 12 browser journeys; after shared Canvas/Agent layer placement, four Node and six browser regressions passed. UI request failures are surfaced rather than presented as empty successful data. These checks do not verify public hostile-tenant isolation or unfinished cloud infrastructure.

## Requirements and campus increment - 2026-10-12

Independent read-only review and real local regressions covered new writes/recovery, Agent state and campus relationships. Four reproduced issues were fixed: trailing-slash aliases could bypass managed product.json protection; large reads lost their hash to invalid JSON truncation; a partially failed multi-file write could retain old preview success; directory ownership UI depended on the first 100 schools. Empty path segments are now denied, Agent reads are structured pages, mutation attempts invalidate evidence before execution, and directory records carry authoritative owner IDs independent of pagination.

Human/Agent edits and restores use expected SHA-256 under a per-project write queue, with owner authorization and retained revision/audit records. Protected path variants, stale hashes, cross-project revisions and stranger reads are tested. This does not implement distributed writers or an atomic DB/filesystem transaction; the control service remains one writer. A failed batch may leave explicitly logged partial edits, requiring re-read and verification.

Campus records are scoped to each application's independent DB. Composite foreign keys reject cross-school/campus references, school owners/app admins maintain records, and event owners alone change their event links. Self-declared student affiliations are private to that account and never grant an official verified role. Input is validated and values are parameterized; SQL identifiers come only from fixed allowlists. Application-local public directory data has no account email/session/password. Deleting referenced parents is blocked. PGlite and native PostgreSQL restart, access and concurrency checks passed.

All 12 browser journeys and five final affected Node tests passed. Public hostile-tenant execution, dedicated runner separation, TLS ingress, signed executable module publication and shared multi-worker locks remain unverified or unimplemented. The local trusted processes are not an untrusted-code security boundary.

## Project lifecycle, export and design follow-up

- DELETE/restore/export require project ownership; deleted projects cannot be edited, restarted, exported or selected for new Agent tasks. Deletion cancels active/blocked tasks and stops real processes. Restore preserves business data and files without restarting instances.
- Independent review identified an archive/restore race and quota bypass through concurrent create/restore. Shared application lifecycle locks plus transactional account row locks fix them. Integration tests and native PostgreSQL concurrency checks pass. Multi-process control-plane leases remain outside this local boundary.
- Independent export uses an explicit shared-source allowlist, symlink rejection, size limits and authenticated/no-store download. The extracted package was installed and run independently with fresh accounts, real writes and persistence after restart. Secret sentinel and control-account exclusion were tested. User-authored source is exported as source and can contain values its author wrote there; this is not a general secret scanner or backup.
- Design-only jobs have a restricted tool allowlist and persist validated proposals. They cannot create projects, change files or deploy. Large automatically expanded plans are revalidated after bounded layout and unique edge assignment. This was contract-tested, not tested against a live model.
- Exported Compose now forwards database and SMTP settings; HTTP verification probes loopback even when a public origin is configured. Actual Docker startup, cloud ingress, HTTPS and hostile-code containment remain BLOCKED. Exported code is for the recipient's trusted local machine or dedicated deployment, not arbitrary untrusted tenants.
- UI localization preserves enum values, identities and user content; React continues escaping interpolation. The Canvas loading guard prevents delayed draft initialization from overwriting editable input.

## Commerce, community and guided Canvas

- Commercial modules enforce shop ownership, buyer/seller order roles, expected-price consent, integer cents and row-locked inventory/coupon/booking capacity. Order retry keys are idempotent; cancellation restores reserved capacity once. Future appointments cannot be marked complete. Native PostgreSQL and local PGlite transaction tests pass.
- Forum/profile/showcase code is reused across platform and app databases. Public APIs omit login email, password and sessions. Only deliberately saved profiles appear in directories; school claims are self-declared. App install gates, author ownership, Origin checks, React text escaping and HTTP(S)-only showcase links are tested.
- Creator/merchant content creation has per-owner quotas serialized with advisory transaction locks. These do not replace OS disk quotas or production abuse controls.
- Canvas v2 checks product intent presence, dependency nodes/edges, typed ports and required business inputs. Invalid structures cannot be saved by bypassing the UI. Replacement graphs commit with installs atomically; rejected changes preserve prior data. Structural validation does not prove arbitrary business correctness.
- Independent reviewer identified price-consent, early service completion, persistent quota and replacement-graph bugs; fixes and regression evidence are in `docs/INDEPENDENT_REVIEW.md`.
- No online payments, funds custody, refund engine, fraud handling or complete community abuse/moderation workflow is implemented. This local release is not ready for public commercial hosting.

## Implemented and tested locally

- Salted scrypt passwords, hashed random sessions, HttpOnly/SameSite cookies, rate limits, explicit owner checks, no global platform user table exposed to apps.
- Separate application PostgreSQL data directories/accounts; parameterized SQL; transaction locks for enrollment and FIFO promotion.
- Request Origin checking for mutations, React escaping, CSP/nosniff/frame policy, private chat membership authorization.
- Image decode and re-encode, size/pixel/storage limits, generated filenames, no user-controlled file path serving.
- Project path scoping, traversal/symlink/hidden-secret/Windows-device-name rejection, file quotas and persisted revisions.
- Model/tool schemas, scoped owner context, tool allowlist, step/repair budgets, cancellation, durable job trace; no arbitrary shell tool.
- APP_* secrets encrypted with AES-GCM and a local vault key, values omitted from metadata/audit, newline and reserved runtime key checks, known-value redaction in retrieved deployment logs.
- Pending module releases require administrator review. Built-in namespace and other owners' releases cannot be overwritten by publishers. Declarative contract allowlist is enforced.
- Preview URLs use per-app localhost subdomains. Secure deployments use __Host- prefixed cookies and explicit expected origins.
- Local generated executable code is rejected; only shipped first-party runtime source runs in local-trusted mode. Actual process crash/recovery was tested.
- Kernel-owned Windows named-pipe storage locks prevent concurrent embedded database opens and stay held while a process is unresponsive. No heartbeat-based takeover. Linux abstract-socket implementation is untested; this is a same-host guard, not shared-volume/container fencing.
- Offline local backups require exclusive control/application storage ownership, preserve empty directories, validate file hashes, refuse symlinks/traversal/overwrites and restore into a new directory. External PostgreSQL, container-backed and unknown app storage are refused. Real restored API/media/session/vault behavior is tested.

## Not a production security boundary

The 80-module expansion adds typed JSON field validation, per-record ownership, private collection reads and installed-module checks. Graph saves reject private-to-shared embedding/copying, cycles, invalid targets and oversize project specifications before mutation. Connector execution is transactional and capped at 160 steps; nested embedding is limited to three levels. Uninstall removes graph nodes, and stale runtime graphs cannot write to uninstalled targets. Independent review findings were repaired and covered by regression tests. Each user is limited to 1,000 lifetime records per collection; list responses cap at 200, with pagination UI still absent.

The static-resource limiter exception checks the matched GET route under `/assets/`, not user-controlled raw path text. A regression issues 320 asset requests and then verifies the API's 300/minute allowance plus a rejected 301st request. CSP permits `blob:` for image preview only; no arbitrary executable code or external connector HTTP is enabled by visual composition.

Local-trusted processes share the operating-system account and are not hostile-code sandboxes. Their resource quotas are application-level controls, not OS-enforced isolation. Never expose this mode as an open multi-tenant hosting service.

Docker execution and deployment definitions include non-root users, read-only root, network restrictions, capability removal, no-new-privileges, CPU/memory/PID limits and explicit mounts. These remain UNTESTED because Docker is absent. Enabling a boolean flag does not constitute a security review. Dynamic HTTPS ingress and dedicated privileged runner separation are unfinished.

General cross-app sharing, team authorization and arbitrary uploaded executable module publishing are not enabled. Module definitions and source text are treated as untrusted data; prompt-injection defenses are tool-boundary restrictions, not a claim that a model cannot be manipulated.

## Residual risks and engineering work

1. Isolate the Docker runner from the control service and validate host/network/container escape assumptions before untrusted execution.
2. Implement and test independent app domains, automatic authenticated routing, TLS and cookie/Host boundaries with actual generated backends.
3. Add OS/database-enforced tenant roles/quotas, disk quotas and resource-abuse tests for public operation.
4. Add signed immutable code artifacts, executable module supply-chain review and true simultaneous code-version execution. Current supported extension review covers declarative recipes only.
5. Local offline backups and restore drills are tested. Add offsite encrypted backup scheduling, retention, PostgreSQL/container-native backups, secret rotation and Windows ACL review. Backups contain vault keys, credentials and data; hashes detect corruption but are not signatures. POSIX mode flags alone do not establish Windows filesystem privacy.
6. Long-lived SSE sessions are revalidated every 15 seconds and closed on logout/expiry; more comprehensive upload/conversation abuse controls are still needed before public use.
7. Complete real model/provider and generated-code red-team checks. Scripted contract tests do not establish model robustness.
8. Native dependency advisory scan reported no vulnerabilities, but transitive native libraries and external services require ongoing review.

No public hosting, external production modification or cloud purchase occurred. Independent source review and fixes are recorded in docs/INDEPENDENT_REVIEW.md.
