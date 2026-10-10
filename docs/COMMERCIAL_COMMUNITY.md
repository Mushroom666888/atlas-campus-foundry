# Commercial products, creator community and guided canvas

Scope: local trusted applications. This release adds 14 reusable modules to the previous 80 without deleting old definitions, accounts, projects or databases. The registry now contains 94 built-ins: 10 commercial, 4 community, 10 foundation, 50 campus collections, 12 connectors, 8 presentation modules. The 50 earlier campus collections remain basic typed collections, not complete commercial transaction engines.

## Modules

| Module | Contract ID | Real behavior |
|---|---|---|
| 商家店铺 | merchant-storefront | One shop per merchant, editable description and location |
| 商品货架 | product-catalog | Images, categories, search, price, publish/pause |
| 库存管理 | stock-inventory | Optimistic inventory edits; transaction reservation and release |
| 交易订单 | sales-orders | Buyer/seller ownership, integer money snapshots, price consent, idempotency |
| 交付与核销 | order-fulfillment | Seller accepts and prepares; buyer confirms receipt |
| 服务预约 | service-booking | Future slots, atomic capacity limits, cancellations and completion |
| 交易评价 | transaction-reviews | One review per completed order, buyer only |
| 店铺优惠券 | discount-coupons | Shop-scoped fixed discounts, minimum amount, expiry and atomic redemption |
| 商品收藏 | product-favorites | Private per-user favorites |
| 经营看板 | merchant-analytics | Owner-scoped order totals and booking counts |
| 用户主页 | creator-profiles | Public name, self-declared school, bio and tags |
| 交流论坛 | discussion-forum | Topics, search, replies, author editing/deletion and admin deletion |
| 产品展示 | product-showcase | Opt-in publication, description, stage, category and safe external links |
| 用户目录 | member-directory | Search voluntarily completed public profiles by school, tags and name |

Authentication, persistent per-application accounts, private/group chat, media and notifications remain shared foundation modules. There is no duplicate account system. The community service and React components are used by both Atlas and generated applications, while each deployed app retains its own accounts, SQL database and sessions. App community content does not appear in the Atlas forum.

## User flows

- Atlas: `/community`, `/community/products`, `/community/creators`, `/creators/<account-id>`. Reading is public; writing requires an account. Profile schools are explicitly self-declared. Public responses do not expose account email, password hash or sessions.
- Modules: `/modules` supports commercial/community filters, search, installation and `+论坛 +个人主页 +私聊 +登录接口 +交易` references. Detail previews are explicitly local examples, separate from deployed app data. API and dependency contracts are displayed.
- Commerce: merchant opens a shop and publishes inventory. Buyer submits an order at an explicitly confirmed price. Seller accepts and adds handover instructions. Buyer confirms receipt and can review. Cancellation before handover restores inventory once. Money uses integer cents; the total is an offline settlement agreement, not a captured payment.
- Appointments: merchant publishes future service slots; users reserve one capacity unit. Repeated reservation is idempotent. Cancellation releases the slot; the merchant cannot complete a future appointment. Completion after its start is merchant-attested, not proof that service was actually delivered.

## Canvas version 2

New canvas saves require a product description of at least 12 characters. It remains a user-authored product specification, not proof that an LLM interpreted intent. New modules automatically include recursively resolved dependencies and visible dependency edges. Four positions distinguish foundation, product business, automation and presentation. Dragged nodes return to their layer. Dependency, navigation, notification, embedding, display and automation have distinct contracts.

Invalid port combinations turn red. Incomplete dependencies, unconnected connectors/views, missing intent, cycles and privacy violations block save/generation. Browser and server use the same validator; manually submitting an invalid version 2 graph is rejected. Version 1 projects remain readable and keep their prior validation contract. Open an older graph, use dependency repair, review the description and save to upgrade it. The layer layout is a visual convention; the server validates semantics rather than pixel positions.

Commercial order/inventory data deliberately cannot be wired into generic record mutation connectors. Use its audited business APIs. Navigation connects actual pages; interface wiring does not generate new arbitrary business code. Passing structure checks is followed by the platform build/deployment checks and does not establish business correctness for every possible user idea.

## Storage and boundaries

- Additive migrations: `control/002_community.sql`, `runtime/003_commerce.sql`, `runtime/004_community.sql`.
- Product reservation locks the product row. Coupons lock their row within the same transaction. Order transitions lock the order; cancel restores inventory and coupon capacity only once. Booking capacity is serialized on the service row.
- Merchant content quotas: 500 products, 1000 service slots, 500 coupons per shop. Creator quotas: 50 products, 500 discussions and 5000 replies per author. Creation and quota check share a transaction with an advisory owner lock.
- External showcase links allow only HTTP(S), without embedded credentials. Content uses plain React text, never raw user HTML. Requests are parameterized and origin checked. Audited community deletion is available to the author or an existing admin role; runtime admin provisioning is not provided by these modules.
- Commerce list APIs currently cap responses at 100 shops / 200 records. Full large-history pagination and long-term data archiving remain engineering follow-ups. They are not billing or database storage quotas.

## Reproduction

`npm run dev` starts the local platform. `npm run deploy-commerce` creates or starts Campus Commerce with all 14 new modules plus private chat and resolved foundations. `npm run deploy-commerce -- --redeploy` refreshes its trusted runtime after source changes. It does not seed public community posts or fabricate merchants. Its address and canvas link are written to `.data/commercial-showcase.json`.

`npm run check` runs lint, build and Node tests. `npm run e2e` includes community, commercial multiuser deployment, guided canvas, earlier 80-module workflows and the original three applications. `npm run verify-integrations` continues to handle external model/runtime readiness.

## Explicit limitations

No payment capture, escrow, refunds, platform commissions or payment-provider webhooks are implemented. No claim of online funds movement is made. Commerce runs with offline settlement. Public hosting, HTTPS, automated abuse moderation, account bans, per-tenant resource containment, Docker verification and live LLM generation remain under the existing production gates. Do not open this local trusted runner to hostile tenants.
