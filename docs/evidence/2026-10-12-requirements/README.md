# Evidence index

These are actual Windows local results from 2026-10-12. Screenshots were rendered by Chromium; there are no image-generated UI mockups.

| File | Scope |
|---|---|
| check-final.txt | Full lint/build/typecheck and 28 passing Node tests |
| browser-polish-final.txt | All 12 full browser journeys passing after the main UI changes |
| browser-lane-regression.txt | Six passing browser journeys after shared layer placement |
| layer-agent-tests.txt | Four affected Agent/design/composition tests passing |
| targeted-final.txt | Earlier five passing security/workspace/domain/Agent regressions |
| live-audit-final.txt, routes-final.json | 69 existing-account routes/viewports, no errors/overflow |
| postgres.txt, postgres-results.json | Native PostgreSQL 18.4 migrations/restart/row-lock quota race |
| dependency-audit.json | Production dependency audit, zero known advisories |
| integration-results.json | Honest model/Docker/SMTP blockers, PostgreSQL local alternative |
| showcase-reuse-report.json | Five declared apps, one shared current source implementation |
| final-smoke.json, canvas-final.png | Post-restart browser/app health and final Canvas render |
| spec-*.png, campus-*.png | New specification and runtime domain at 1440/390/320px |
| studio-*.png | Inspected project/module/Canvas/community desktop/mobile surfaces |

`browser-initial.txt`, `browser-second.txt`, `browser-third.txt`, `domain-initial.txt`, `domain-runtime-failure.png` and `browser-lane-final.txt` preserve failed attempts. `browser-lane-final.txt` is the failed lane check before the shared classification fix; **browser-lane-regression.txt is the successful final rerun**. `smoke-first-incomplete.json` is the interrupted hostname API-client probe, not a success.

Raw browser traces contain authenticated traffic, so they remain under ignored `.data/requirements-failures/` and `.data/ui-polish-failures/`. Canvas polish initially failed due to overlay hit interception, hidden mobile minimap and missed small-handle gestures; final checks keep actual dragging and assert each new edge. No required assertions or business functionality were removed to turn tests green.

Saved product acceptance scenarios are NOT_RUN. Tool contract tests are not real-model evidence. Local trusted app deployment is not Docker/hostile-tenant/public-hosting acceptance.
