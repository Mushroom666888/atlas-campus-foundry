# Decisions

- Use TypeScript with an explicit shared module contract and a modular control plane.
- Research code is read as data; repositories without a license are reference-only.
- Prefer PostgreSQL semantics. Evaluate PGlite for real durable local Windows execution and PostgreSQL server adapter for deployment.
- Generated code execution must be denied when the required isolated runner is unavailable.
- Keep paid services and production changes behind explicit user configuration; collect dependencies in docs/USER_ACTION_REQUIRED.md.
- Use kernel-lifetime local storage locks rather than stale heartbeat leases, so an unresponsive database owner cannot be mistaken for an offline source.
- Restore local backups to a new directory, retain terminal lifecycle history, and require explicit redeployment. Include empty PostgreSQL directories and the vault key; reject unsupported remote/container storage instead of silently omitting data.
