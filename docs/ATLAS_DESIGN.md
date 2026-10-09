# Atlas design direction

Brand name: Atlas. Repository and existing data directories remain Campus AI App Foundry for continuity.

The user explicitly selected a high-contrast agency-style homepage: orange/red gradient, oversized ATLAS lettering passing through a main image, grid, light and visual depth. The home route is `/`; the existing authenticated dashboard moves to `/studio`. Application runtime `/` routes remain unchanged.

## Sources

- Finesse UI: https://github.com/mouse-lin/finesse-skill/tree/main/skills/finesse-ui (MIT). Read SKILL.md, design-dna, product-ui, product-palettes, divergence and preflight references. No external installer or unreviewed executable was run. Downloaded read-only detector is saved under ignored `.data/design-references/`.
- Cosmic Cliffs / NGC 3324: https://images.nasa.gov/details/carina_nebula . Credit NASA, ESA, CSA, STScI. Original published 2022-07-12. Locally hosted WebP derivatives are color-graded and layered; they are a branding artwork, not scientifically color-accurate rendering. No endorsement is implied.
- Archivo Black: Google Fonts / SIL Open Font License. Local font and license in `public/assets/`; no runtime font-CDN dependency.
- Noto Sans SC: local WOFF2 subsets generated for 616 Chinese glyphs in three files, with SIL OFL license. Uncovered characters use the system CJK fallback. Rebuild subsets with `node scripts/prepare-atlas-fonts.mjs` when copy expands.
- Taste Skill: https://github.com/Leonxlnx/taste-skill . Actually cloned via Git after module/canvas functional acceptance to `.data/design-references/taste-skill`, commit `18dfc928b135629e0eddfdd445a06400d04ed439`. Read `skills/taste-skill/SKILL.md` and `skills/redesign-skill/SKILL.md`. Applied type hierarchy, content cleanup, local fonts, purposeful motion, compact app surfaces and dependency reduction. No global installation or repository installer was run.

The user authorized autonomous image selection and explicitly required browser QA; those instructions take precedence over the skill's optional approval and browser-handoff workflow. Repository rules take precedence for fixed breakpoint typography, zero letter spacing, radius <= 8px, real imagery and no decorative card containers.

## Visual contract

Brand: full-width cosmic raster, coral-to-rose gradient, near-white ATLAS wordmark between the image layers, light technical grid, restrained pointer parallax. Natural gas silhouettes mask portions of letters. Product: ink sidebar, cool off-white work surfaces, coral primary actions, teal informational surfaces; compact typography and clear status semantics. No giant hero typography or decorative movement within the tool surfaces.

Motion: wordmark arrival, subtle image depth on fine-pointer devices, directional link hover. Reduced-motion preference freezes the scene and disables entrance animation. No WebGL or GPU-intensive particle simulation is claimed.

Home counts are derived from the real module catalog. All module links, category tabs, creation actions and Studio navigation are functional. No fabricated logos, testimonials, usage metrics or customer claims.

## Actual review

Playwright verified real imagery, CTA/routes, category tabs, mobile menu, one-line ATLAS text, next-section visibility, no page overflow and reduced-motion behavior at nine desktop/tablet/phone sizes. Screenshots of the homepage, Studio, module detail/library, canvas and real deployed apps were inspected. A stretched canvas search field and premature loading screenshots were repaired. Files are under `artifacts/screenshots/`.

Lighthouse mobile lab: performance 85, accessibility 100, best practices 100; FCP 2.7s, LCP 3.8s, TBT 0ms, CLS 0. Earlier 66/96/96 with 7.7s LCP is retained for comparison. The homepage now consumes a build-time catalog projection, mobile raster variants and compressed responses. These are local lab measurements; the larger remaining JavaScript/CSS and resource discovery chain remain optimization opportunities.

Finesse detector: zero P0 findings. Two P2 advisories remain: it searches for a stamp in TSX, while the actual stamp is in `atlas.css`; 37 color literals could be consolidated into tokens. Local `.finesse/log.json` records the design coordinates, per the skill's format.

The user rejected an intermediate appearance; the final Taste pass is implemented and tested, but has not received user visual approval. Do not describe it as approved or imply the unfinished live LLM/container/public-hosting requirements passed.
