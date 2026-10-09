# Atlas acceptance evidence

`check.txt` records the passing lint/build/15-test run. The subsequent frontend-only image selection/search-field change passed a fresh build, lint and the final browser suite in `browser.txt`. `results.json` consolidates browser counts, native PostgreSQL results, shared-source verification, local application health and final Lighthouse measurements.

Full screenshots and raw Lighthouse data remain in the ignored local `artifacts/` directory. Reproduce with `npm run check`, `npm run e2e`, `npm run verify-postgres`, `npm run reuse-report`. Keep runtime source unchanged while deployment/backup tests run, since artifacts deliberately reject source-fingerprint changes. Build before browser testing, and restart the live server after rebuilding its hashed assets.

## Retained failures

- Original browser sweep: two passed, two failed after static requests exhausted the IP budget. `artifacts/browser-results-before-rate-fix.json` retains the result. One job submission stayed on `/builder` with rate-limit error; the following test could not reach registration. Final static/API separation test and all four browser workflows pass.
- Intermediate backup test: expected `running`, got `failed` with source-version mismatch after `server/http.ts` changed while the test was running. The source guard correctly prevented silent substitution. Stable-source rerun: 15/15 pass with unchanged assertions.
- Initial Lighthouse: 66/96/96 and LCP 7.7s. Final: 85/100/100 and LCP 3.8s. Remaining performance headroom is not hidden.
- One manual live redeployment preceded startup readiness and received ECONNREFUSED. Retrying after the ready signal succeeded; final health is recorded for all four apps.

Live LLM, Docker containment, external email delivery, public HTTPS and arbitrary executable-module extraction have not passed real acceptance. No skipped tests are represented as successes. Module details use explicitly labeled local examples, while deployed app tests use real databases and APIs.
