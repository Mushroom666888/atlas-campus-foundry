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
