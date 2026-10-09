# User action required

Do not paste secrets into chat. Configure them in the ignored `.env` file on this machine.

| Priority | Resource | Why / blocked features | Local alternative | Minimal action | Configuration | Verification |
|---|---|---|---|---|---|---|
| P0 | LLM provider credentials and model | Live natural-language planning, custom code generation and repair | No local model discovered; deterministic assembly will be labeled separately | Enter provider base URL, model and key locally | LLM_BASE_URL, LLM_MODEL, LLM_API_KEY | npm run verify-integrations |
| P0 | Docker Engine | Isolated build/test and execution of generated code | Trusted packaged runtime only; no untrusted local execution | Install/enable Docker Desktop with a working engine when available | DOCKER_HOST if non-default | npm run verify-integrations |
| P3 | Authorized server and domain | Public deployment and HTTPS | Local preview | Supply authorized server context later; no purchase performed | Deployment configuration | Deployment smoke command will be added |

Detailed provider setup and commands will be completed alongside the adapters. No user action is needed to continue independent implementation.
