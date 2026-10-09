# Decisions

- Use TypeScript with an explicit shared module contract and a modular control plane.
- Research code is read as data; repositories without a license are reference-only.
- Prefer PostgreSQL semantics. Evaluate PGlite for real durable local Windows execution and PostgreSQL server adapter for deployment.
- Generated code execution must be denied when the required isolated runner is unavailable.
- Keep paid services and production changes behind explicit user configuration; collect dependencies in docs/USER_ACTION_REQUIRED.md.
