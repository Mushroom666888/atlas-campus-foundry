# Redesign acceptance

`check.txt`: lint, production build and all 16 Node tests. Includes the backwards-compatible persisted-manifest test and new real frontend HTTP test.

`browser.txt`: four Playwright journeys pass. The warning about FORCE_COLOR is tooling output, not a failed test. Tests cover homepage at nine widths with explicit non-overlap assertions, original three apps, module previews/references and actual drag/connect/deployment.

`existing-account-routes.json`: 42 checks (14 actual existing-account routes at 1440, 390, 320px), no page errors. Screenshots are in local `artifacts/atlas-redesign/`. This account contains the historical community module that caused the reported blank pages; the old data is preserved.

The final edge-label CSS enlargement was followed by a fresh typecheck/build, lint and all 42 live route checks including the label-size assertion. Source-level backend tests did not need repetition for that CSS-only change. Previous Lighthouse measurements were not reused as new results.
