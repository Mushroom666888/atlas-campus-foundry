# Atlas readability and navigation repair

2026-10-10. User feedback: ATLAS obscured, small text, clutter, multiple pages not opening.

## Reproduced defect and fix

The existing local account has a published `study-waitlist` module from before the catalog expansion. Its persisted manifest had no `aliases`, `icon` or `configurationFields`. New frontend code treated the raw SQL value as a current manifest, so `.aliases.join()` crashed the module explorer, canvas, AI Builder and creation form. Fresh-account tests did not include this old release.

`Projects.available()` now parses stored manifests through the current Zod contract, whose metadata defaults are backwards compatible. Returned modules are ordered consistently by the built-in catalog, with community IDs and newest semantic versions following. No existing manifest, account or project was deleted. A regression removes the new metadata from an actual database release before API retrieval and installation.

Static assets now resolve under `/assets/` at request time, avoiding a frozen startup list after rebuild. HTML is no-store; missing scripts and API paths return 404 instead of the HTML shell. A page error boundary provides reload and home actions instead of an unexplained white screen. These do not bypass authentication or module permissions.

## Design changes

- Removed the foreground image layer. ATLAS sits above the complete cosmic raster with its own space, separated from the intro and primary action.
- Simplified the homepage into the image/wordmark, a module section and footer. Removed the extra promotional band and tiny English labels.
- 16px base text, 14px secondary text, 20px module titles; descriptions use 16px. Main controls have 44px minimum height. Compact labels no longer use 9-12px CSS sizes.
- Module library uses fewer columns and single-column phone cards. Removed duplicated tags, fixed ordering and strengthened whitespace and headings.
- Canvas defaults to at least 90% zoom; properties appear only when something is selected. Overview controls still let users zoom out. Node titles, contracts and edge labels are enlarged.
- Existing project data and all module/Agent/deployment actions remain available. A missing live model is still reported as a real configuration block.

## Verification

- `npm run check`: lint, production build and 16 tests pass.
- `npm run e2e`: four workflows pass. Homepage tests check nine widths, wordmark/intro/action separation, imagery, reduced motion and navigation.
- `npx tsx scripts/audit-studio.ts`: actual existing account, 14 routes x three widths = 42 route checks, including the old community module, saved canvas, Builder, creation, publishing, deployments and project workspace. No page errors or document overflow.
- Screenshots manually inspected: homepage desktop/phone, module grid, old module details, Builder, canvas and narrow creation form.
- Four existing apps redeployed locally and shared-source verification passed. Live URLs remain in ignored `.data` metadata. This is not public or isolated untrusted-code hosting.

Evidence: `docs/evidence/2026-10-10-redesign/`, full screenshots `artifacts/atlas-redesign/` and `artifacts/screenshots/`. Do not present the previous Lighthouse score as a measurement of this redesign. User visual approval is still pending.
