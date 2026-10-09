# Blockers

- Live LLM integration: no model credentials discovered. Implement adapter and contract tests; live generation remains BLOCKED until securely configured.
- Docker isolation validation: Docker and WSL are not installed. Implement Docker adapter; do not execute untrusted generated code in control plane or claim container isolation tested.
- Public hosting: no authorized external server/domain. Local service verification remains possible.
