# Campus domain contracts

The existing `campus` module now owns relational school data. This does not add another catalog entry. Migration `migrations/runtime/005_campus_domain.sql` is additive and runs in each application's own database, including independently exported apps.

## Resources

| Collection   | Relationship                                                        | Management                                      |
| ------------ | ------------------------------------------------------------------- | ----------------------------------------------- |
| universities | Root directory record                                               | Creator or application administrator            |
| campuses     | University                                                          | University creator or application administrator |
| buildings    | University and campus                                               | Same                                            |
| venues       | University, optional campus/building, optional capacity/coordinates | Same                                            |
| courses      | University, optional course code                                    | Same                                            |
| clubs        | University, optional campus                                         | Same                                            |
| affiliations | Current application account and university                          | Current account only                            |
| event links  | Existing event, university, optional venue and club                 | Event creator only                              |

Composite foreign keys prevent linking a building, venue or club to a different university. These tables reuse application accounts; platform account data is not exposed. Deleting a referenced parent returns HTTP 409. Existing generic `school`, `location` and course records are retained and not silently reclassified.

## HTTP API

- `GET /api/campus/contracts`: collections, fields and supported operations.
- `GET /api/campus/:collection`: search and pagination; `q`, `universityId`, `limit`, `offset`.
- `POST /api/campus/:collection`: create a directory record.
- `PUT /api/campus/:collection/:id`: update a record with ownership checks.
- `DELETE /api/campus/:collection/:id`: delete an unreferenced record.
- `GET/PUT /api/campus/me/affiliations`, `DELETE /api/campus/me/affiliations/:id`: own school relationships.
- `GET/PUT /api/campus/events/:id/location`: event school/venue/club metadata.

See `packages/contracts/src/campus.ts` for exact request schemas and `packages/modules/src/campus.ts` for endpoints. The allowed identifiers are fixed; input values use parameterized SQL. Quotas are 20 universities per owner, 1000 records per school/collection and 20 personal affiliations. Row locks serialize concurrent quota checks; native PostgreSQL verifies the boundary race.

## Runtime UI and boundaries

The application **Campus directory** tab provides six collections, search/filter/pagination, editable records and personal affiliations. Event details support selecting a school, venue and club. All labels support Chinese/English. A map link exists only when coordinates are supplied; Atlas does not invent campus locations.

School affiliations are self-declarations, not official student verification. Event links are descriptive metadata, not venue reservations or club approval. Course enrollment and course-specific study-group rules remain application logic. Structured product requirements describe intended roles/models/scenarios; saving those descriptions does not create tables, grant privileges or execute acceptance scenarios.

Verification: `tests/campus-domain.test.ts`, `tests/requirements.browser.spec.ts`, `scripts/verify-postgres.ts`. Evidence is retained under `docs/evidence/2026-10-12-requirements/`.
