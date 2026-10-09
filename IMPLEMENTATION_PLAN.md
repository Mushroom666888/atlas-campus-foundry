# Implementation plan

Status values: TODO / IN_PROGRESS / TESTING / DONE / BLOCKED. Evidence states: IMPLEMENTED / TESTED / DEPLOYED / BLOCKED / PLANNED.

| ID | Objective | Dependencies | Scope | Acceptance | Status | Evidence |
|---|---|---|---|---|---|---|
| R01 | GitHub ecosystem research | Network | scripts/research, docs/research | Real provenance, 50-100 relevant samples if available, taxonomy and license audit | IN_PROGRESS | Pending |
| A01 | Architecture and contracts | R01 | packages, migrations, architecture | Typed manifest, tenant model, execution boundary | TODO | Pending |
| C01 | Durable control plane | A01 | server | Authentication, projects, scoped access, migrations, jobs | TODO | Pending |
| M01 | Shared campus modules | A01,C01 | packages/runtime | Real persistence, authorization, contracts and module tests | TODO | Pending |
| G01 | Agent and tools | C01,M01 | server/agent | Provider adapter, bounded tool loop, persisted logs, controlled file changes | TODO | Credentials may block live LLM |
| U01 | Developer Studio | C01,M01,G01 | web | Chinese operational UI and browser checks | TODO | Pending |
| D01 | Application build and deployment | M01,G01 | server/deployment | Real runtime, health, restart persistence, rollback, isolation gate | TODO | Docker absent |
| V01 | Three products and reuse | M01,U01,D01 | tests, apps | Events, Marketplace, Study Buddy flows, shared source proof | TODO | Pending |
| E01 | Module ecosystem loop | G01,V01 | registry, tests | Extract, review, publish, install and execute in independent app | TODO | Pending |
| Q01 | Security and independent review | All | tests, reports | Cross-tenant, auth, uploads, agent paths, deployment review | TODO | Pending |
| H01 | Delivery and recovery | All | scripts, docs | Reproducible commands, evidence, checkpoints, remaining actions | IN_PROGRESS | This plan |

External dependencies do not block independent tasks. Every stage must preserve failing evidence and distinguish deterministic assembly from live model generation.
