# Blockers and remaining work

## External resources

- LLM credentials/model: live requests, custom code generation and self-repair remain BLOCKED. Real adapter and tools are implemented.
- Docker Engine: no Docker/WSL runtime is installed. Isolated builds/tests and generated-code deployment remain BLOCKED; host execution is denied.
- Independent domains/HTTPS/authorized host: no public environment was provided. No DNS change, cloud purchase or public deployment was performed.
- SMTP delivery (optional): local outbox works; actual email transport/delivery is unverified. University SSO is not implemented.

Native PostgreSQL was installed as test tooling and verified autonomously. No external database credential is required for local use.

## Engineering gaps, not user code-fixing tasks

- Dedicated privileged runner separation and dynamic HTTPS application routing.
- Arbitrary executable module extraction/signing/publication; current extraction supports declarative capacity/FIFO policies.
- Independent business API/browser acceptance of actual LLM-generated code after live resources are available.
- Simultaneous incompatible built-in module code versions; built-ins are currently bound to platform releases. Declarative version upgrade/rollback is tested.
- Collaborative team UI/authorization, cross-app grant execution, configurable third-party module schemas, offsite backup scheduling and multi-worker leases. Local offline backup/restore is implemented and tested.
- Online payments, escrow, refunds, commissions and reconciliation are not implemented; commerce currently records offline settlement agreements. No payment credentials are required for the current local workflows.
- Full pagination for large commerce/record histories (current bounded response sizes), operational moderation/reporting/account bans and long-term archival remain engineering work. The forum already supports owner editing and owner/admin deletion, but that is not a complete abuse-response system.

The current scoped local feature acceptance has no remaining failing test. The unscoped historical `reuse-report` still flags another account's older application source; its data and ownership were preserved. Five declared samples pass `reuse-report -- --showcase`. Unexecuted provider/container tests are BLOCKED, not passed.
