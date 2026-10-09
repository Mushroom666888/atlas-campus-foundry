# Decisions

- Use TypeScript with an explicit shared module contract and a modular control plane.
- Research code is read as data; repositories without a license are reference-only.
- Prefer PostgreSQL semantics. Evaluate PGlite for real durable local Windows execution and PostgreSQL server adapter for deployment.
- Generated code execution must be denied when the required isolated runner is unavailable.
- Keep paid services and production changes behind explicit user configuration; collect dependencies in docs/USER_ACTION_REQUIRED.md.
- Use kernel-lifetime local storage locks rather than stale heartbeat leases, so an unresponsive database owner cannot be mistaken for an offline source.
- Restore local backups to a new directory, retain terminal lifecycle history, and require explicit redeployment. Include empty PostgreSQL directories and the vault key; reject unsupported remote/container storage instead of silently omitting data.
- Extend to 80 contracts using 50 distinct typed domain collections on one SQL/authorization/UI engine, with 12 bounded connectors and 8 display modules. Do not count empty placeholders or claim official university/payment integrations.
- Treat visual composition as a real declarative development workflow, distinct from template copying and live LLM programming. Local execution accepts only shipped actions; arbitrary generated code still requires a verified isolated runner.
- Parse +module references deterministically before model calls and retain them in job events and module selection constraints.
- Reject private-to-shared graph paths, stale uninstalled targets, cyclic graphs and oversize specifications before mutation. Validate embedding with node/depth memoization.
- Follow the user's Atlas art direction on the homepage; use compact, quiet product surfaces for repeated work. Git-cloned taste-skill at 18dfc928b135629e0eddfdd445a06400d04ed439 after functional acceptance. Apply compatible advice without global installers or overriding accessibility and repository rules.
- Keep API request limits intact while excluding matched static GET asset routes. Ship homepage catalog summaries at build time, local font subsets, mobile image variants and HTTP compression.
