# Independent review

Read-only review performed by a separate Codex review agent. No reviewed file was edited concurrently by that agent. Source review conclusions are distinct from executed tests.

| Finding | Resolution | Verification |
|---|---|---|
| Custom backend never loaded | Explicit Docker-only `register(app,context)` loading and custom `/custom/` assets | IMPLEMENTED; execution BLOCKED by absent Docker and domain gate |
| Browser cookies shared across ports | Application links use unique `app-<uuid>.localhost` hosts; custom code additionally requires domain/HTTPS/Secure-cookie configuration | Browser apps tested; hostile custom-code ingress remains BLOCKED |
| Rollback uses current recipes/workspace | Snapshot product, module lock, recipe and workspace; restore prior artifact; reject changed shared source | Real process rollback regression TESTED |
| Encrypted env never injected | AES-GCM vault + per-app Docker env file, newline/reserved-key rejection | Vault round-trip and leakage checks TESTED; Docker injection BLOCKED |
| Agent preview stale after spec/modules changed | Invalidate validation flags for specification and installation changes | Regression TESTED using contract-only provider |
| Resolver request-order dependence | Constraint backtracking with bounded search and cycle detection | Order-independence regression TESTED |
| Abrupt restart leaves children | IPC disconnect shutdown; Docker named-container reconciliation on startup | Actual Windows process crash recovery TESTED; Docker branch BLOCKED |
| Stale storage lease can be stolen from an unresponsive owner | Replaced timer lease with kernel-owned local endpoint | Child blocked for 11 seconds retains ownership; process death releases it, TESTED on Windows |
| Restore changes terminal deployment history | Rebase all paths, interrupt only active states | failed/deleted/stopped and building-state assertions TESTED |
| App storage provenance missing from backup | Record per-app backend/isolation; refuse remote, Docker and unknown storage | Refusal tests TESTED |

Backup follow-up review found no remaining material defect within its offline/local scope. Empty-directory preservation was also repaired following an actual failed restore, then verified by restarting the recovered application's HTTP service. Linux/cross-container locking and offsite backup operations are not claimed as tested.

No production isolation certification was issued. Local-trusted execution is restricted to shipped first-party runtime source. Pending Docker and live model tests are not substituted by mocks.

## Commerce, community and Canvas review (2026-10-10)

The existing independent reviewer performed a second read-only pass. Findings were repaired by the implementation agent:

| Finding | Resolution | Verification |
|---|---|---|
| Product price may change between buyer view and order submission | Required expected price checked while holding the product row lock; stale consent returns HTTP 409 | Commercial integration test |
| Merchant could complete an appointment before its start | Reject future appointment completion | Commercial integration test |
| Persistent creator/merchant content lacked bounded creation | Per-owner quotas checked under advisory locks in the same transaction as insertion | Community and commerce quota tests |
| Removing a complete v2 graph branch retained old duplicate connector instances and rejected a valid save | Validate replacement graph and commit it with installations/name atomically | Real Projects/database regression; invalid update leaves spec/file/install history unchanged |

The reviewer reported no further concrete ownership or runtime community install-gate bypass in that pass. This is a scoped source review, not a hostile-tenant or production security certification.
