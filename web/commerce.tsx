import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Heart,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Store,
} from "lucide-react";
import { api, post, useLoad } from "./api";
import { Empty, Loading, Modal, Notice, useAction } from "./components";
import type {
  PublicUser,
  ModuleManifest,
} from "../packages/contracts/src/index";
import {
  money,
  orderStatus,
  type Shop,
  type CommerceProduct,
  type CommerceOrder,
  type ServiceSlot,
  type Booking,
  type Coupon,
  type Review,
} from "../packages/contracts/src/commerce";
import { commerceDefinitions } from "../packages/modules/src/commerce-catalog";
import "./commerce.css";

type Props = { moduleId: string; user: PublicUser; modules: string[] };
function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return (
    <>
      {action.error && <Notice>{action.error}</Notice>}
      {action.message && <Notice kind="success">{action.message}</Notice>}
    </>
  );
}
function FormModal({
  title,
  children,
  onClose,
  onSave,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSave: (f: FormData) => Promise<void>;
}) {
  const action = useAction();
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="commerce-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void action.run(() => onSave(f));
        }}
      >
        {children}
        <Feedback action={action} />
        <button className="primary" disabled={action.busy}>
          <Check size={17} />
          {action.busy ? "正在保存" : "确认保存"}
        </button>
      </form>
    </Modal>
  );
}
const string = (f: FormData, key: string) => String(f.get(key) || "");
const cents = (f: FormData, key: string) =>
  Math.round(Number(f.get(key)) * 100);
function Amount({
  name,
  label,
  initial = 0,
  min = 0,
}: {
  name: string;
  label: string;
  initial?: number;
  min?: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        name={name}
        defaultValue={initial / 100}
        min={min}
        step="0.01"
        max={100000}
        required
      />
    </label>
  );
}
export function CommerceModule(props: Props) {
  const id = props.moduleId;
  return (
    <section className="commerce-module">
      <div className="section-head">
        <div>
          <span className="eyebrow">CAMPUS COMMERCE</span>
          <h2>{commerceDefinitions.find((m) => m.id === id)?.name}</h2>
        </div>
        <span className="commerce-settlement">线下结算</span>
      </div>
      {id === "merchant-storefront" ? (
        <Shops {...props} />
      ) : id === "product-catalog" ||
        id === "stock-inventory" ||
        id === "product-favorites" ? (
        <Products {...props} />
      ) : id === "sales-orders" || id === "order-fulfillment" ? (
        <Orders {...props} />
      ) : id === "service-booking" ? (
        <Services {...props} />
      ) : id === "discount-coupons" ? (
        <Coupons />
      ) : id === "transaction-reviews" ? (
        <Reviews />
      ) : (
        <Analytics />
      )}
    </section>
  );
}
function Shops({ user }: Props) {
  const load = useLoad<{ items: Shop[] }>("/api/commerce/shops"),
    [edit, setEdit] = useState(false),
    own = load.data?.items.find((s) => s.owner_id === user.id);
  return (
    <>
      {load.error && <Notice>{load.error}</Notice>}
      <div className="commerce-toolbar">
        <button className="primary" onClick={() => setEdit(true)}>
          <Plus size={17} />
          {own ? "编辑店铺" : "开设店铺"}
        </button>
      </div>
      {load.loading ? (
        <Loading />
      ) : !load.data?.items.length ? (
        <Empty>还没有商家入驻</Empty>
      ) : (
        <div className="commerce-grid">
          {load.data.items.map((s) => (
            <article className="commerce-item" key={s.id}>
              <Store size={26} />
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <span className="muted">{s.location || "未填写营业地点"}</span>
              {s.owner_id === user.id && (
                <span className="badge">我的店铺</span>
              )}
            </article>
          ))}
        </div>
      )}
      {edit && (
        <FormModal
          title={own ? "编辑店铺" : "开设店铺"}
          onClose={() => setEdit(false)}
          onSave={async (f) => {
            await api(`/api/commerce/shops${own ? "/mine" : ""}`, {
              method: own ? "PUT" : "POST",
              body: JSON.stringify(Object.fromEntries(f)),
            });
            setEdit(false);
            await load.refresh();
          }}
        >
          <label>
            店铺名称
            <input
              name="name"
              defaultValue={own?.name}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label>
            店铺介绍
            <textarea
              name="description"
              defaultValue={own?.description}
              maxLength={2000}
              rows={4}
            />
          </label>
          <label>
            营业地点
            <input
              name="location"
              defaultValue={own?.location}
              maxLength={160}
            />
          </label>
        </FormModal>
      )}
    </>
  );
}
function Products({ moduleId, user, modules }: Props) {
  const inventory = moduleId === "stock-inventory",
    favorites = moduleId === "product-favorites";
  const [q, setQ] = useState(""),
    [mine, setMine] = useState(inventory),
    [add, setAdd] = useState(false),
    [detail, setDetail] = useState<CommerceProduct | null>(null),
    [stock, setStock] = useState<CommerceProduct | null>(null),
    [requestKey, setRequestKey] = useState(crypto.randomUUID());
  const load = useLoad<{ items: CommerceProduct[] }>(
      favorites
        ? "/api/commerce/favorites"
        : `/api/commerce/products?mine=${mine}&q=${encodeURIComponent(q)}`,
    ),
    action = useAction();
  return (
    <>
      <Feedback action={action} />
      {load.error && <Notice>{load.error}</Notice>}
      <div className="commerce-toolbar">
        {!favorites && (
          <form
            className="search-input"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(string(new FormData(e.currentTarget), "q"));
            }}
          >
            <Search size={18} />
            <input
              name="q"
              placeholder="搜索商品"
              aria-label="搜索商品"
              maxLength={100}
            />
            <button>搜索</button>
          </form>
        )}
        {!inventory && !favorites && (
          <label className="inline-check">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
            />
            只看我的商品
          </label>
        )}
        {!inventory && !favorites && (
          <button className="primary" onClick={() => setAdd(true)}>
            <Plus size={17} />
            发布商品
          </button>
        )}
      </div>
      {load.loading ? (
        <Loading />
      ) : !load.data?.items.length ? (
        <Empty>{favorites ? "还没有收藏商品" : "暂无商品"}</Empty>
      ) : (
        <div className="commerce-grid">
          {load.data.items.map((p) => (
            <article className="commerce-item" key={p.id}>
              {p.image_id ? (
                <img
                  className="commerce-product-image"
                  src={`/api/uploads/${p.image_id}`}
                  alt={p.title}
                />
              ) : (
                <div className="commerce-product-placeholder">
                  <ShoppingBag size={36} />
                  <span>{p.category}</span>
                </div>
              )}
              <span className="muted">{p.shop_name}</span>
              <h3>{p.title}</h3>
              <div className="commerce-price">
                <strong>{money(p.price_cents)}</strong>
                <span>库存 {p.stock}</span>
              </div>
              <div className="inline-actions">
                <button
                  onClick={() => {
                    setDetail(p);
                    setRequestKey(crypto.randomUUID());
                  }}
                >
                  查看商品
                </button>
                {p.owner_id === user.id && (
                  <>
                    <button
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(async () => {
                          await api(`/api/commerce/products/${p.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              status:
                                p.status === "active" ? "paused" : "active",
                            }),
                          });
                          await load.refresh();
                        })
                      }
                    >
                      {p.status === "active" ? "下架" : "上架"}
                    </button>
                    {modules.includes("stock-inventory") && (
                      <button onClick={() => setStock(p)}>调整库存</button>
                    )}
                  </>
                )}
                {modules.includes("product-favorites") && (
                  <button
                    aria-label={favorites ? "取消收藏" : "收藏商品"}
                    title={favorites ? "取消收藏" : "收藏商品"}
                    onClick={() =>
                      void action.run(
                        async () => {
                          await api(`/api/commerce/favorites/${p.id}`, {
                            method: favorites ? "DELETE" : "PUT",
                          });
                          await load.refresh();
                        },
                        favorites ? "已取消收藏" : "已加入收藏",
                      )
                    }
                  >
                    <Heart size={18} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {add && (
        <FormModal
          title="发布商品"
          onClose={() => setAdd(false)}
          onSave={async (f) => {
            const file = f.get("image") as File;
            let imageId = null;
            if (file?.size) {
              const upload = new FormData();
              upload.append("file", file);
              imageId = (
                await api<{ id: string }>("/api/uploads", {
                  method: "POST",
                  body: upload,
                })
              ).id;
            }
            await post("/api/commerce/products", {
              title: string(f, "title"),
              description: string(f, "description"),
              category: string(f, "category"),
              priceCents: cents(f, "price"),
              stock: Number(f.get("stock")),
              imageId,
            });
            setAdd(false);
            await load.refresh();
          }}
        >
          <label>
            商品名称
            <input name="title" required maxLength={120} />
          </label>
          <label>
            商品说明
            <textarea name="description" maxLength={4000} rows={4} />
          </label>
          <label>
            分类
            <input
              name="category"
              required
              maxLength={40}
              placeholder="数码 / 书籍 / 手作"
            />
          </label>
          <Amount name="price" label="单价（元）" min={0.01} />
          <label>
            可售库存
            <input
              type="number"
              name="stock"
              defaultValue={1}
              min={0}
              max={100000}
              required
            />
          </label>
          <label>
            商品图片
            <input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
          </label>
        </FormModal>
      )}
      {stock && (
        <FormModal
          title="调整可售库存"
          onClose={() => setStock(null)}
          onSave={async (f) => {
            await api(`/api/commerce/products/${stock.id}/stock`, {
              method: "PUT",
              body: JSON.stringify({
                stock: Number(f.get("stock")),
                version: stock.version,
              }),
            });
            setStock(null);
            await load.refresh();
          }}
        >
          <p>{stock.title}</p>
          <label>
            当前可售数量
            <input
              type="number"
              name="stock"
              defaultValue={stock.stock}
              min={0}
              max={100000}
              required
            />
          </label>
        </FormModal>
      )}
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)}>
          {detail.image_id && (
            <img
              className="commerce-product-image"
              src={`/api/uploads/${detail.image_id}`}
              alt={detail.title}
            />
          )}
          <p className="preserve-lines">{detail.description}</p>
          <p>
            {detail.shop_name} · {detail.category}
          </p>
          <p className="commerce-price">
            <strong>{money(detail.price_cents)}</strong> / 件
          </p>
          <Feedback action={action} />
          {modules.includes("sales-orders") && detail.owner_id !== user.id && (
            <form
              className="commerce-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action.run(async () => {
                  await post("/api/commerce/orders", {
                    productId: detail.id,
                    expectedPriceCents: detail.price_cents,
                    quantity: Number(f.get("quantity")),
                    coupon: string(f, "coupon"),
                    requestKey,
                  });
                  setDetail(null);
                  await load.refresh();
                }, "下单成功，可在交易订单中查看。款项由双方线下结算。");
              }}
            >
              <label>
                购买数量
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  max={Math.min(100, detail.stock)}
                  defaultValue={1}
                  required
                />
              </label>
              {modules.includes("discount-coupons") && (
                <label>
                  店铺优惠码（选填）
                  <input name="coupon" maxLength={32} />
                </label>
              )}
              <button
                className="primary"
                disabled={
                  action.busy ||
                  detail.stock === 0 ||
                  detail.status !== "active"
                }
              >
                <ShoppingBag size={17} />
                提交订单
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
function Orders({ user, moduleId, modules }: Props) {
  const [role, setRole] = useState(
      moduleId === "order-fulfillment" ? "seller" : "buyer",
    ),
    load = useLoad<{ items: CommerceOrder[] }>(
      `/api/commerce/orders?role=${role}`,
    ),
    action = useAction(),
    [ready, setReady] = useState<CommerceOrder | null>(null),
    [review, setReview] = useState<CommerceOrder | null>(null);
  const transition = (o: CommerceOrder, act: string) =>
    void action.run(async () => {
      await post(`/api/commerce/orders/${o.id}/transition`, { action: act });
      await load.refresh();
    }, "订单状态已更新");
  return (
    <>
      <div className="tabs">
        <button
          className={role === "buyer" ? "selected" : ""}
          onClick={() => setRole("buyer")}
        >
          我买到的
        </button>
        <button
          className={role === "seller" ? "selected" : ""}
          onClick={() => setRole("seller")}
        >
          我卖出的
        </button>
      </div>
      <Feedback action={action} />
      {load.error && <Notice>{load.error}</Notice>}
      {load.loading ? (
        <Loading />
      ) : !load.data?.items.length ? (
        <Empty>暂无订单</Empty>
      ) : (
        <div className="commerce-orders">
          {load.data.items.map((o) => (
            <article key={o.id} className="commerce-order">
              <div className="section-head">
                <h3>{o.title}</h3>
                <span className={`badge ${o.status}`}>
                  {orderStatus[o.status]}
                </span>
              </div>
              <p>
                {o.quantity} 件 × {money(o.unit_price_cents)}
                {o.discount_cents > 0 && ` · 优惠 ${money(o.discount_cents)}`}
              </p>
              <div className="commerce-price">
                <strong>{money(o.total_cents)}</strong>
                <span>线下结算金额</span>
              </div>
              {o.fulfillment_note && <p>交付说明：{o.fulfillment_note}</p>}
              <div className="inline-actions">
                {o.seller_id === user.id && o.status === "placed" && (
                  <button
                    disabled={action.busy}
                    onClick={() => transition(o, "accept")}
                  >
                    确认接单
                  </button>
                )}
                {o.seller_id === user.id &&
                  o.status === "accepted" &&
                  modules.includes("order-fulfillment") && (
                    <button onClick={() => setReady(o)}>安排交付</button>
                  )}
                {o.buyer_id === user.id &&
                  o.status === "ready" &&
                  modules.includes("order-fulfillment") && (
                    <button
                      disabled={action.busy}
                      onClick={() => transition(o, "complete")}
                    >
                      确认收货
                    </button>
                  )}
                {["placed", "accepted"].includes(o.status) && (
                  <button
                    disabled={action.busy}
                    onClick={() => transition(o, "cancel")}
                  >
                    取消订单
                  </button>
                )}
                {o.buyer_id === user.id &&
                  o.status === "completed" &&
                  modules.includes("transaction-reviews") && (
                    <button onClick={() => setReview(o)}>
                      <Star size={17} />
                      评价订单
                    </button>
                  )}
              </div>
              <small className="muted">
                {new Date(o.created_at).toLocaleString("zh-CN")}
              </small>
            </article>
          ))}
        </div>
      )}
      {ready && (
        <FormModal
          title="安排交付"
          onClose={() => setReady(null)}
          onSave={async (f) => {
            await post(`/api/commerce/orders/${ready.id}/transition`, {
              action: "ready",
              note: string(f, "note"),
            });
            setReady(null);
            await load.refresh();
          }}
        >
          <label>
            交付地点与取货说明
            <textarea name="note" required maxLength={500} rows={3} />
          </label>
        </FormModal>
      )}
      {review && (
        <FormModal
          title="评价订单"
          onClose={() => setReview(null)}
          onSave={async (f) => {
            await post("/api/commerce/reviews", {
              orderId: review.id,
              rating: Number(f.get("rating")),
              body: string(f, "body"),
            });
            setReview(null);
          }}
        >
          <label>
            评分
            <select name="rating">
              {[5, 4, 3, 2, 1].map((v) => (
                <option key={v} value={v}>
                  {v} 星
                </option>
              ))}
            </select>
          </label>
          <label>
            交易体验
            <textarea name="body" required maxLength={2000} rows={4} />
          </label>
        </FormModal>
      )}
    </>
  );
}
function Services({ user }: Props) {
  const load = useLoad<{ items: ServiceSlot[] }>("/api/commerce/services"),
    bookings = useLoad<{ items: Booking[] }>("/api/commerce/bookings"),
    action = useAction(),
    [add, setAdd] = useState(false);
  return (
    <>
      <div className="commerce-toolbar">
        <button className="primary" onClick={() => setAdd(true)}>
          <Plus size={17} />
          发布服务时段
        </button>
      </div>
      <Feedback action={action} />
      {(load.error || bookings.error) && (
        <Notice>{load.error || bookings.error}</Notice>
      )}
      <div className="commerce-grid">
        {load.data?.items.map((s) => (
          <article className="commerce-item" key={s.id}>
            <span className="muted">{s.shop_name}</span>
            <h3>{s.title}</h3>
            <p>{s.description}</p>
            <p>{new Date(s.starts_at).toLocaleString("zh-CN")}</p>
            <div className="commerce-price">
              <strong>{money(s.price_cents)}</strong>
              <span>剩余 {s.capacity - s.reserved} 个名额</span>
            </div>
            {s.owner_id !== user.id && (
              <button
                disabled={action.busy || s.reserved >= s.capacity}
                onClick={() =>
                  void action.run(async () => {
                    await post(`/api/commerce/services/${s.id}/book`);
                    await load.refresh();
                    await bookings.refresh();
                  }, "预约已确认")
                }
              >
                预约此时段
              </button>
            )}
          </article>
        ))}
      </div>
      {!load.loading && !load.data?.items.length && (
        <Empty>暂无可预约时段</Empty>
      )}
      <h3>我的预约与服务</h3>
      {bookings.data?.items.map((b) => (
        <article key={b.id} className="commerce-order">
          <div className="section-head">
            <strong>{b.title}</strong>
            <span className="badge">
              {
                { booked: "已预约", cancelled: "已取消", completed: "已完成" }[
                  b.status
                ]
              }
            </span>
          </div>
          <p>
            {new Date(b.starts_at).toLocaleString("zh-CN")} ·{" "}
            {money(b.price_cents)}
          </p>
          {b.status === "booked" && (
            <div className="inline-actions">
              <button
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await post(`/api/commerce/bookings/${b.id}/transition`, {
                      action: "cancel",
                    });
                    await bookings.refresh();
                    await load.refresh();
                  })
                }
              >
                取消预约
              </button>
              {b.owner_id === user.id && (
                <button
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      await post(`/api/commerce/bookings/${b.id}/transition`, {
                        action: "complete",
                      });
                      await bookings.refresh();
                    })
                  }
                >
                  完成服务
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      {add && (
        <FormModal
          title="发布服务时段"
          onClose={() => setAdd(false)}
          onSave={async (f) => {
            await post("/api/commerce/services", {
              title: string(f, "title"),
              description: string(f, "description"),
              priceCents: cents(f, "price"),
              startsAt: new Date(string(f, "starts")).toISOString(),
              capacity: Number(f.get("capacity")),
            });
            setAdd(false);
            await load.refresh();
          }}
        >
          <label>
            服务名称
            <input name="title" required maxLength={120} />
          </label>
          <label>
            服务介绍
            <textarea name="description" maxLength={2000} rows={3} />
          </label>
          <Amount name="price" label="每人价格（元）" />
          <label>
            服务时间
            <input name="starts" type="datetime-local" required />
          </label>
          <label>
            预约名额
            <input
              name="capacity"
              type="number"
              min={1}
              max={10000}
              defaultValue={1}
              required
            />
          </label>
        </FormModal>
      )}
    </>
  );
}
function Coupons() {
  const load = useLoad<{ items: Coupon[] }>("/api/commerce/coupons"),
    [add, setAdd] = useState(false),
    action = useAction();
  return (
    <>
      <button className="primary" onClick={() => setAdd(true)}>
        <Plus size={17} />
        创建优惠码
      </button>
      <Feedback action={action} />
      {load.error && <Notice>{load.error}</Notice>}
      <div className="commerce-grid">
        {load.data?.items.map((c) => (
          <article className="commerce-item" key={c.id}>
            <code>{c.code}</code>
            <h3>
              满 {money(c.minimum_cents)} 减 {money(c.discount_cents)}
            </h3>
            <p>
              已使用 {c.uses} / {c.max_uses} 次
            </p>
            <p>{new Date(c.expires_at).toLocaleString("zh-CN")} 到期</p>
            <button
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await api(`/api/commerce/coupons/${c.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ active: !c.active }),
                  });
                  await load.refresh();
                })
              }
            >
              {c.active ? "停用" : "启用"}
            </button>
          </article>
        ))}
      </div>
      {add && (
        <FormModal
          title="创建店铺优惠码"
          onClose={() => setAdd(false)}
          onSave={async (f) => {
            await post("/api/commerce/coupons", {
              code: string(f, "code"),
              discountCents: cents(f, "discount"),
              minimumCents: cents(f, "minimum"),
              maxUses: Number(f.get("limit")),
              expiresAt: new Date(string(f, "expires")).toISOString(),
            });
            setAdd(false);
            await load.refresh();
          }}
        >
          <label>
            优惠码
            <input
              name="code"
              pattern="[A-Za-z0-9-]{3,32}"
              required
              maxLength={32}
            />
          </label>
          <Amount name="minimum" label="最低订单金额（元）" />
          <Amount name="discount" label="减免金额（元）" min={0.01} />
          <label>
            可用次数
            <input
              name="limit"
              type="number"
              min={1}
              max={100000}
              defaultValue={10}
              required
            />
          </label>
          <label>
            到期时间
            <input name="expires" type="datetime-local" required />
          </label>
        </FormModal>
      )}
    </>
  );
}
function Reviews() {
  const load = useLoad<{ items: Review[] }>("/api/commerce/reviews");
  return (
    <>
      {load.error && <Notice>{load.error}</Notice>}
      {load.loading ? (
        <Loading />
      ) : !load.data?.items.length ? (
        <Empty>还没有已完成交易的评价</Empty>
      ) : (
        load.data.items.map((r) => (
          <article className="commerce-order" key={r.id}>
            <div className="section-head">
              <strong>{r.title}</strong>
              <span className="review-stars" aria-label={`${r.rating} 星`}>
                {Array.from({ length: r.rating }, (_, i) => (
                  <Star key={i} size={18} fill="currentColor" />
                ))}
              </span>
            </div>
            <p className="preserve-lines">{r.body}</p>
            <small>{r.author_name} · 已完成交易</small>
          </article>
        ))
      )}
    </>
  );
}
function Analytics() {
  const load = useLoad<Record<string, number | string>>(
    "/api/commerce/analytics",
  );
  return (
    <>
      {load.error && <Notice>{load.error}</Notice>}
      {load.loading ? (
        <Loading />
      ) : (
        load.data && (
          <>
            <div className="commerce-metrics">
              {[
                ["累计订单", load.data.total_orders],
                ["待履约", load.data.pending_orders],
                ["完成订单金额", money(Number(load.data.completed_cents))],
                ["已完成订单", load.data.completed_orders],
                ["待服务预约", load.data.upcoming_bookings],
                ["已完成预约", load.data.completed_bookings],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="muted">
              订单金额按已完成订单统计；不代表支付服务确认的收入。
            </p>
          </>
        )
      )}
    </>
  );
}

export function CommercePreview({ module }: { module: ModuleManifest }) {
  const d = commerceDefinitions.find((d) => d.id === module.moduleId)!,
    [step, setStep] = useState(0),
    [quantity, setQuantity] = useState(1),
    [liked, setLiked] = useState(false),
    [rating, setRating] = useState(5);
  return (
    <div className="commerce-preview">
      <Notice kind="info">
        交互示例，不创建订单。安装后使用应用内的真实业务数据。
      </Notice>
      <div className="commerce-journey">
        {d.steps.map((s, i) => (
          <button
            key={s}
            className={step === i ? "selected" : ""}
            onClick={() => setStep(i)}
          >
            <span>{i + 1}</span>
            {s}
            {i < d.steps.length - 1 && <ArrowRight size={17} />}
          </button>
        ))}
      </div>
      <div className="commerce-demo-screen">
        <div className="section-head">
          <span className="commerce-demo-brand">
            <Store size={23} />
            校园创作者商店
          </span>
          <span className="badge">{d.steps[step]}</span>
        </div>
        {module.moduleId === "merchant-storefront" ? (
          <>
            <h3>独立手作与校园好物</h3>
            <p>设计、制作、交付，都发生在校园里。</p>
            <div className="demo-shop-products">
              <ShoppingBag size={34} />
              <div>
                <strong>校园纪念帆布袋</strong>
                <p>原创手作 · ¥39.00</p>
              </div>
            </div>
          </>
        ) : module.moduleId === "service-booking" ? (
          <>
            <h3>毕业季摄影 · 30 分钟</h3>
            <p>西门广场 · ¥99.00 / 人</p>
            <div className="inline-actions">
              {["09:00", "10:00", "11:00"].map((t, i) => (
                <button
                  key={t}
                  className={step === i ? "selected" : ""}
                  onClick={() => setStep(i)}
                >
                  {t}
                </button>
              ))}
            </div>
            <p>
              {step === 2
                ? "预约完成，商家收到通知。"
                : "选择时段后锁定一个名额。"}
            </p>
          </>
        ) : module.moduleId === "transaction-reviews" ? (
          <>
            <h3>订单已完成</h3>
            <div className="review-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  aria-label={`${n} 星`}
                  onClick={() => setRating(n)}
                >
                  <Star
                    size={24}
                    fill={n <= rating ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
            <p>评分 {rating} / 5 · 仅订单买家可提交</p>
          </>
        ) : module.moduleId === "merchant-analytics" ? (
          <div className="commerce-metrics">
            {[
              ["完成订单", "12"],
              ["订单金额", "¥468.00"],
              ["待履约", "3"],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        ) : module.moduleId === "discount-coupons" ? (
          <>
            <h3>WELCOME10</h3>
            <p>满 ¥50.00 减 ¥10.00</p>
            <label>
              商品件数
              <input
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Math.min(10, Number(e.target.value))))
                }
              />
            </label>
            <div className="commerce-price">
              <strong>
                {money(3900 * quantity - (quantity >= 2 ? 1000 : 0))}
              </strong>
              <span>{quantity >= 2 ? "已满足满减门槛" : "未达到门槛"}</span>
            </div>
          </>
        ) : (
          <>
            <div className="demo-shop-products">
              <Package size={38} />
              <div>
                <h3>校园纪念帆布袋</h3>
                <span>¥39.00 / 件</span>
              </div>
            </div>
            {module.moduleId === "stock-inventory" ? (
              <>
                <label>
                  示例可售库存
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        Math.max(0, Math.min(99, Number(e.target.value))),
                      )
                    }
                  />
                </label>
                <p>
                  {step === 1
                    ? `下单后剩余 ${Math.max(0, quantity - 1)} 件`
                    : `可售 ${quantity} 件`}
                </p>
              </>
            ) : module.moduleId === "product-favorites" ? (
              <button onClick={() => setLiked(!liked)}>
                <Heart size={18} fill={liked ? "currentColor" : "none"} />
                {liked ? "已收藏" : "加入收藏"}
              </button>
            ) : (
              <>
                <div className="commerce-price">
                  <strong>¥39.00</strong>
                  <span>
                    {step === 0
                      ? "待下单"
                      : step === 1
                        ? "商家已接单"
                        : "等待买家确认收货"}
                  </span>
                </div>
                <button
                  className="primary"
                  onClick={() => setStep((step + 1) % 3)}
                >
                  {step === 0
                    ? "体验下单"
                    : step === 1
                      ? "安排交付"
                      : "重新体验"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
