# Security report

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
