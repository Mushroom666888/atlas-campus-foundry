# Module candidates and evidence

The 72 screened repositories include 58 with captured README evidence. Signals below are not code verification. See `repositories.json` and `evidence/` for URLs, timestamps and failures; 35 unrelated or unsuitable results were excluded.

| Priority | Shared capability | README/description signals | Decision |
|---|---|---:|---|
| P0 | Identity / app-local profiles | 33 / 50 | Shared account service, no university SSO claims |
| P0 | Content / media / search | 31 / 31 / 28 | Shared entities with scoped permissions and explicit types |
| P0 | Campus locations | 22 | User-provided coordinates and OpenStreetMap links, no invented campus data |
| P0 | Events / registration / notifications | 21 / 18 | Transactional enrollment, durable inbox |
| P0 | Chat / groups | 15 / 14 | Durable conversations and server-sent events |
| Later | Timetables / booking / lost and found | 22 / 15 / 9 | Domain extensions after core integration |

Examples inspected: TigerAppsOrg/TigerPath documents Django, PostgreSQL and a frontend asset server, as well as optional university API credentials. mohuishou/scuplus-wechat documents course schedules, library search, reminders, campus places and a separate Go backend with API documentation. gdufeZLYL/springboot-squirrel documents Spring Boot, MyBatis, Thymeleaf and MySQL. These support separating domain contracts from UI implementation rather than importing heterogeneous application code.

Repeated candidate entities: account, profile, school, course, place, content, membership, message. These are inferred architectural candidates; source-level entity and API equivalence has NOT been established. Reference implementations are not vendored. All first-party module code is original.

Sampling limitations: ranked GitHub search is not representative of all campus software; no minimum star threshold was used; maintenance metadata is captured but not proof of quality. Three descriptions indicate non-peer-matching study assistants; retained only as adjacent study product references. No sample repository was built or security audited.
