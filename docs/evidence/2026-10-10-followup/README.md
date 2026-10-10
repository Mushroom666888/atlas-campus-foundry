# Follow-up verification evidence

Date: 2026-10-10. Host: Windows, Node 24.17.0.

- `check-first.txt`: first 24-test full check before additional concurrency regression.
- `check-final.txt`: lint/build and all 25 Node tests passed.
- `browser-full-passed.json`: ten full browser journeys, including minimal homepage and three real apps.
- `browser-final-passed.json`: seven affected journeys after final localization/Canvas loading fixes.
- `postgres-results.json`: native PostgreSQL 18.4 migration, create/restore quota race and restart persistence.
- `live-routes.json`: 69 existing-account route/viewport checks.
- `ui-audit.json`: bilingual routes and actual CJK font information. Chinese user content is deliberately retained in English mode.
- `showcase-reuse-report.json`: current shared source provenance for the five declared sample apps.
- `lifecycle-final.txt`, `export-final.txt`: final focused regressions after deployment-list filtering and standalone .env health configuration.
- `home-zh-desktop.png`, `home-zh-mobile.png`, `home-en-desktop.png`, `canvas-en-desktop.png`: actual browser captures.

Failed evidence is retained: initial export, first browser run, second browser run (font inspection readiness and translated dialog title), and Canvas input overwritten by delayed draft initialization. Fixes preserve the required assertions. TypeScript variable shadowing and callback signature errors were resolved before build success. Full traces contain authentication requests and remain only in ignored `.data/followup-*`.

The ten-journey pass predates the last translation/loading refinements; those changes received the seven-journey regression pass. The 25-test full check predates the final deployment-list/export configuration fixes; their focused test logs are included. No live model, Docker or cloud result is represented by these local/scripted-provider checks.
