import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../contracts/src/index.js";
import {
  shopInput,
  commerceProductInput,
  orderInput,
  couponInput,
  serviceInput,
  type Shop,
  type CommerceProduct,
  type CommerceOrder,
  type Coupon,
  type ServiceSlot,
  type Booking,
} from "../../contracts/src/commerce.js";
import { requireUser } from "../../../server/auth.js";
import type { Database, SQL } from "../../../server/db.js";
import { withQuota } from "./quota.js";

export function registerCommerce(
  app: FastifyInstance,
  db: Database,
  modules: string[],
) {
  const id = (r: FastifyRequest) =>
    z.object({ id: z.uuid() }).parse(r.params).id;
  const user = (r: FastifyRequest, module: string) => {
    const account = requireUser(r);
    if (!modules.includes(module))
      throw new AppError(409, "MODULE_NOT_INSTALLED", `未安装模块：${module}`);
    return account;
  };
  const fail = (message: string): never => {
    throw new AppError(409, "COMMERCE_CONFLICT", message);
  };
  const denied = (): never => {
    throw new AppError(403, "FORBIDDEN", "无权操作其他用户的业务数据");
  };
  const missing = (): never => {
    throw new AppError(404, "NOT_FOUND", "业务记录不存在");
  };
  async function shop(owner: string, sql: SQL = db): Promise<Shop> {
    return (
      (
        await sql.query<Shop>(
          "SELECT * FROM commerce_shops WHERE owner_id=$1",
          [owner],
        )
      ).rows[0] || fail("请先开设店铺")
    );
  }
  async function notify(sql: SQL, userId: string, body: string) {
    if (modules.includes("notifications"))
      await sql.query(
        "INSERT INTO notifications(id,user_id,body) VALUES($1,$2,$3)",
        [randomUUID(), userId, body],
      );
  }
  async function product(
    productId: string,
    sql: SQL = db,
    lock = false,
  ): Promise<CommerceProduct> {
    return (
      (
        await sql.query<CommerceProduct>(
          `SELECT p.*,s.owner_id,s.name AS shop_name FROM commerce_products p JOIN commerce_shops s ON s.id=p.shop_id WHERE p.id=$1${lock ? " FOR UPDATE OF p" : ""}`,
          [productId],
        )
      ).rows[0] || missing()
    );
  }
  app.get("/api/commerce/shops", async (r) => {
    user(r, "merchant-storefront");
    return {
      items: (
        await db.query(
          "SELECT * FROM commerce_shops ORDER BY created_at DESC LIMIT 100",
        )
      ).rows,
    };
  });
  app.post("/api/commerce/shops", async (r, reply) => {
    const account = user(r, "merchant-storefront"),
      input = shopInput.parse(r.body);
    const result = await db.query(
      "INSERT INTO commerce_shops(id,owner_id,name,description,location) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id) DO NOTHING RETURNING *",
      [randomUUID(), account.id, input.name, input.description, input.location],
    );
    if (!result.rows.length) fail("你已经有一家店铺，可直接修改营业信息");
    return reply.code(201).send(result.rows[0]);
  });
  app.put("/api/commerce/shops/mine", async (r) => {
    const account = user(r, "merchant-storefront"),
      input = shopInput.parse(r.body),
      own = await shop(account.id);
    return (
      await db.query(
        "UPDATE commerce_shops SET name=$2,description=$3,location=$4 WHERE id=$1 RETURNING *",
        [own.id, input.name, input.description, input.location],
      )
    ).rows[0];
  });
  app.get("/api/commerce/products", async (r) => {
    const account = user(r, "product-catalog"),
      query = z
        .object({
          q: z.string().max(100).default(""),
          category: z.string().max(40).default(""),
          shop: z.uuid().optional(),
          mine: z.enum(["true", "false"]).default("false"),
        })
        .parse(r.query);
    return {
      items: (
        await db.query(
          `SELECT p.*,s.owner_id,s.name AS shop_name FROM commerce_products p JOIN commerce_shops s ON s.id=p.shop_id
      WHERE ($1='' OR strpos(lower(p.title||' '||p.description),lower($1))>0) AND ($2='' OR p.category=$2)
      AND ($3::text IS NULL OR p.shop_id=$3) AND (($4='true' AND s.owner_id=$5) OR ($4='false' AND p.status='active'))
      ORDER BY p.created_at DESC,p.id LIMIT 200`,
          [query.q, query.category, query.shop ?? null, query.mine, account.id],
        )
      ).rows,
    };
  });
  app.post("/api/commerce/products", async (r, reply) => {
    const account = user(r, "product-catalog"),
      input = commerceProductInput.parse(r.body),
      own = await shop(account.id);
    if (
      input.imageId &&
      !(
        await db.query("SELECT id FROM uploads WHERE id=$1 AND owner_id=$2", [
          input.imageId,
          account.id,
        ])
      ).rows.length
    )
      denied();
    return reply.code(201).send(
      (
        await withQuota(db, "commerce_products", own.id, (tx) =>
          tx.query(
            `INSERT INTO commerce_products(id,shop_id,title,description,category,price_cents,stock,image_id,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active') RETURNING *`,
            [
              randomUUID(),
              own.id,
              input.title,
              input.description,
              input.category,
              input.priceCents,
              input.stock,
              input.imageId,
            ],
          ),
        )
      ).rows[0],
    );
  });
  app.patch("/api/commerce/products/:id", async (r) => {
    const account = user(r, "product-catalog"),
      input = z
        .object({
          status: z.enum(["active", "paused"]),
          priceCents: z.number().int().min(1).max(10000000).optional(),
        })
        .strict()
        .parse(r.body);
    return db.transaction(async (tx) => {
      const p = await product(id(r), tx, true);
      if (p.owner_id !== account.id) denied();
      return (
        await tx.query(
          "UPDATE commerce_products SET status=$2,price_cents=COALESCE($3,price_cents),version=version+1 WHERE id=$1 RETURNING *",
          [p.id, input.status, input.priceCents ?? null],
        )
      ).rows[0];
    });
  });
  app.put("/api/commerce/products/:id/stock", async (r) => {
    const account = user(r, "stock-inventory"),
      input = z
        .object({
          stock: z.number().int().min(0).max(100000),
          version: z.number().int().min(1),
        })
        .strict()
        .parse(r.body);
    return db.transaction(async (tx) => {
      const p = await product(id(r), tx, true);
      if (p.owner_id !== account.id) denied();
      if (p.version !== input.version) fail("库存已变化，请刷新后重试");
      return (
        await tx.query(
          "UPDATE commerce_products SET stock=$2,version=version+1 WHERE id=$1 RETURNING *",
          [p.id, input.stock],
        )
      ).rows[0];
    });
  });
  app.get("/api/commerce/orders", async (r) => {
    const account = user(r, "sales-orders"),
      { role } = z
        .object({ role: z.enum(["buyer", "seller"]).default("buyer") })
        .parse(r.query);
    return {
      items: (
        await db.query(
          `SELECT * FROM commerce_orders WHERE ${role === "buyer" ? "buyer_id" : "seller_id"}=$1 ORDER BY created_at DESC LIMIT 200`,
          [account.id],
        )
      ).rows,
    };
  });
  app.post("/api/commerce/orders", async (r, reply) => {
    const account = user(r, "sales-orders"),
      input = orderInput.parse(r.body);
    const result = await db.transaction(async (tx) => {
      // Serialize retries before reserving inventory; PostgreSQL and PGlite share the same contract.
      await tx.query(
        "SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))",
        [account.id, input.requestKey],
      );
      const old = (
        await tx.query<CommerceOrder>(
          "SELECT * FROM commerce_orders WHERE buyer_id=$1 AND request_key=$2",
          [account.id, input.requestKey],
        )
      ).rows[0];
      if (old) {
        const couponCode =
          old.discount_cents > 0
            ? (
                await tx.query<{ code: string }>(
                  "SELECT c.code FROM commerce_coupons c JOIN commerce_orders o ON o.coupon_id=c.id WHERE o.id=$1",
                  [old.id],
                )
              ).rows[0]?.code
            : "";
        if (
          old.product_id !== input.productId ||
          old.quantity !== input.quantity ||
          couponCode !== input.coupon.toUpperCase()
        )
          fail("同一请求标识不能用于不同订单");
        return old;
      }
      const p = await product(input.productId, tx, true);
      if (p.price_cents !== input.expectedPriceCents)
        fail("商品价格已变化，请刷新商品并重新确认");
      if (p.owner_id === account.id) fail("不能购买自己的商品");
      if (p.status !== "active" || p.stock < input.quantity)
        fail("商品已下架或库存不足");
      const subtotal = p.price_cents * input.quantity;
      let discount = 0,
        couponId: string | null = null;
      if (input.coupon) {
        if (!modules.includes("discount-coupons")) fail("应用未安装优惠券模块");
        const c = (
          await tx.query<Coupon>(
            "SELECT * FROM commerce_coupons WHERE shop_id=$1 AND code=$2 FOR UPDATE",
            [p.shop_id, input.coupon.toUpperCase()],
          )
        ).rows[0];
        if (
          !c ||
          !c.active ||
          new Date(c.expires_at).getTime() <= Date.now() ||
          c.uses >= c.max_uses ||
          subtotal < c.minimum_cents
        )
          fail("优惠码无效、已过期、已用完或未满足门槛");
        discount = Math.min(c.discount_cents, subtotal);
        couponId = c.id;
        await tx.query("UPDATE commerce_coupons SET uses=uses+1 WHERE id=$1", [
          c.id,
        ]);
      }
      await tx.query(
        "UPDATE commerce_products SET stock=stock-$2,version=version+1 WHERE id=$1",
        [p.id, input.quantity],
      );
      const order = (
        await tx.query<CommerceOrder>(
          `INSERT INTO commerce_orders(id,buyer_id,seller_id,product_id,title,quantity,unit_price_cents,subtotal_cents,discount_cents,total_cents,coupon_id,status,request_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'placed',$12) RETURNING *`,
          [
            randomUUID(),
            account.id,
            p.owner_id,
            p.id,
            p.title,
            input.quantity,
            p.price_cents,
            subtotal,
            discount,
            subtotal - discount,
            couponId,
            input.requestKey,
          ],
        )
      ).rows[0];
      await notify(tx, p.owner_id, `新订单：${p.title} × ${input.quantity}`);
      return order;
    });
    return reply.code(201).send(result);
  });
  app.post("/api/commerce/orders/:id/transition", async (r) => {
    const account = user(r, "sales-orders"),
      input = z
        .object({
          action: z.enum(["accept", "ready", "complete", "cancel"]),
          note: z.string().trim().max(500).default(""),
        })
        .strict()
        .parse(r.body);
    if (["ready", "complete"].includes(input.action))
      user(r, "order-fulfillment");
    return db.transaction(async (tx) => {
      const o =
        (
          await tx.query<CommerceOrder>(
            "SELECT * FROM commerce_orders WHERE id=$1 FOR UPDATE",
            [id(r)],
          )
        ).rows[0] || missing();
      const buyer = o.buyer_id === account.id,
        seller = o.seller_id === account.id;
      if (!buyer && !seller) denied();
      if (
        (input.action === "complete" && !buyer) ||
        (["accept", "ready"].includes(input.action) && !seller)
      )
        denied();
      const target = {
        accept: "accepted",
        ready: "ready",
        complete: "completed",
        cancel: "cancelled",
      }[input.action];
      if (o.status === target) return o;
      const valid =
        input.action === "cancel"
          ? ["placed", "accepted"]
          : input.action === "accept"
            ? ["placed"]
            : input.action === "ready"
              ? ["accepted"]
              : ["ready"];
      if (!valid.includes(o.status)) fail("当前订单状态不允许此操作");
      if (input.action === "ready" && !input.note)
        fail("请填写交付地点或取货说明");
      if (input.action === "cancel") {
        await tx.query(
          "UPDATE commerce_products SET stock=stock+$2,version=version+1 WHERE id=$1",
          [o.product_id, o.quantity],
        );
        await tx.query(
          "UPDATE commerce_coupons SET uses=uses-1 WHERE id=(SELECT coupon_id FROM commerce_orders WHERE id=$1)",
          [o.id],
        );
      }
      const result = (
        await tx.query(
          "UPDATE commerce_orders SET status=$2,fulfillment_note=CASE WHEN $3='ready' THEN $4 ELSE fulfillment_note END,updated_at=now() WHERE id=$1 RETURNING *",
          [o.id, target, input.action, input.note],
        )
      ).rows[0];
      await notify(
        tx,
        buyer ? o.seller_id : o.buyer_id,
        `订单「${o.title}」状态已更新：${target}`,
      );
      return result;
    });
  });
  app.get("/api/commerce/coupons", async (r) => {
    const account = user(r, "discount-coupons"),
      own = await shop(account.id);
    return {
      items: (
        await db.query(
          "SELECT * FROM commerce_coupons WHERE shop_id=$1 ORDER BY expires_at DESC LIMIT 200",
          [own.id],
        )
      ).rows,
    };
  });
  app.post("/api/commerce/coupons", async (r, reply) => {
    const account = user(r, "discount-coupons"),
      input = couponInput.parse(r.body),
      own = await shop(account.id);
    if (new Date(input.expiresAt).getTime() <= Date.now())
      fail("优惠券有效期必须在未来");
    const result = await withQuota(db, "commerce_coupons", own.id, (tx) =>
      tx.query(
        "INSERT INTO commerce_coupons(id,shop_id,code,discount_cents,minimum_cents,max_uses,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(shop_id,code) DO NOTHING RETURNING *",
        [
          randomUUID(),
          own.id,
          input.code,
          input.discountCents,
          input.minimumCents,
          input.maxUses,
          input.expiresAt,
        ],
      ),
    );
    if (!result.rows.length) fail("该优惠码已存在");
    return reply.code(201).send(result.rows[0]);
  });
  app.patch("/api/commerce/coupons/:id", async (r) => {
    const account = user(r, "discount-coupons"),
      input = z.object({ active: z.boolean() }).strict().parse(r.body),
      own = await shop(account.id);
    const result = await db.query(
      "UPDATE commerce_coupons SET active=$3 WHERE id=$1 AND shop_id=$2 RETURNING *",
      [id(r), own.id, input.active],
    );
    if (!result.rows.length) missing();
    return result.rows[0];
  });
  app.get("/api/commerce/services", async (r) => {
    user(r, "service-booking");
    return {
      items: (
        await db.query(`SELECT s.*,p.name AS shop_name,p.owner_id,(SELECT count(*)::int FROM commerce_bookings b WHERE b.service_id=s.id AND b.status<>'cancelled') AS reserved
    FROM commerce_services s JOIN commerce_shops p ON p.id=s.shop_id WHERE s.status='active' AND s.starts_at>now() ORDER BY s.starts_at LIMIT 200`)
      ).rows,
    };
  });
  app.post("/api/commerce/services", async (r, reply) => {
    const account = user(r, "service-booking"),
      input = serviceInput.parse(r.body),
      own = await shop(account.id);
    if (new Date(input.startsAt).getTime() <= Date.now())
      fail("预约时段必须在未来");
    return reply
      .code(201)
      .send(
        (
          await withQuota(db, "commerce_services", own.id, (tx) =>
            tx.query(
              "INSERT INTO commerce_services(id,shop_id,title,description,price_cents,starts_at,capacity) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
              [
                randomUUID(),
                own.id,
                input.title,
                input.description,
                input.priceCents,
                input.startsAt,
                input.capacity,
              ],
            ),
          )
        ).rows[0],
      );
  });
  app.post("/api/commerce/services/:id/book", async (r, reply) => {
    const account = user(r, "service-booking");
    const result = await db.transaction(async (tx) => {
      const s =
        (
          await tx.query<ServiceSlot>(
            "SELECT s.*,p.owner_id FROM commerce_services s JOIN commerce_shops p ON p.id=s.shop_id WHERE s.id=$1 FOR UPDATE OF s",
            [id(r)],
          )
        ).rows[0] || missing();
      if (s.owner_id === account.id) fail("不能预约自己的服务");
      const old = (
        await tx.query<Booking>(
          "SELECT * FROM commerce_bookings WHERE service_id=$1 AND user_id=$2",
          [s.id, account.id],
        )
      ).rows[0];
      if (old && old.status !== "cancelled") return old;
      if (
        s.status !== "active" ||
        new Date(s.starts_at).getTime() <= Date.now()
      )
        fail("预约已截止");
      const count = (
        await tx.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM commerce_bookings WHERE service_id=$1 AND status<>'cancelled'",
          [s.id],
        )
      ).rows[0].count;
      if (count >= s.capacity) fail("该时段名额已满");
      const booking = (
        await tx.query(
          "INSERT INTO commerce_bookings(id,service_id,user_id,price_cents,status) VALUES($1,$2,$3,$4,'booked') ON CONFLICT(service_id,user_id) DO UPDATE SET status='booked',price_cents=$4 RETURNING *",
          [randomUUID(), s.id, account.id, s.price_cents],
        )
      ).rows[0];
      await notify(tx, s.owner_id, `收到新预约：${s.title}`);
      return booking;
    });
    return reply.code(201).send(result);
  });
  app.get("/api/commerce/bookings", async (r) => {
    const account = user(r, "service-booking");
    return {
      items: (
        await db.query(
          `SELECT b.*,s.title,s.starts_at,p.owner_id FROM commerce_bookings b JOIN commerce_services s ON s.id=b.service_id JOIN commerce_shops p ON p.id=s.shop_id WHERE b.user_id=$1 OR p.owner_id=$1 ORDER BY b.created_at DESC LIMIT 200`,
          [account.id],
        )
      ).rows,
    };
  });
  app.post("/api/commerce/bookings/:id/transition", async (r) => {
    const account = user(r, "service-booking"),
      input = z
        .object({ action: z.enum(["cancel", "complete"]) })
        .strict()
        .parse(r.body);
    return db.transaction(async (tx) => {
      const b =
        (
          await tx.query<Booking>(
            "SELECT b.*,s.title,s.starts_at,p.owner_id FROM commerce_bookings b JOIN commerce_services s ON s.id=b.service_id JOIN commerce_shops p ON p.id=s.shop_id WHERE b.id=$1 FOR UPDATE OF b",
            [id(r)],
          )
        ).rows[0] || missing();
      if (b.user_id !== account.id && b.owner_id !== account.id) denied();
      if (input.action === "complete" && b.owner_id !== account.id) denied();
      if (
        input.action === "complete" &&
        new Date(b.starts_at).getTime() > Date.now()
      )
        fail("服务尚未开始，不能提前标记完成");
      const target = input.action === "cancel" ? "cancelled" : "completed";
      if (b.status === target) return b;
      if (b.status !== "booked") fail("该预约已结束");
      const result = (
        await tx.query(
          "UPDATE commerce_bookings SET status=$2 WHERE id=$1 RETURNING *",
          [b.id, target],
        )
      ).rows[0];
      await notify(
        tx,
        account.id === b.user_id ? b.owner_id : b.user_id,
        `预约「${b.title}」${target === "cancelled" ? "已取消" : "已完成"}`,
      );
      return result;
    });
  });
  app.get("/api/commerce/reviews", async (r) => {
    user(r, "transaction-reviews");
    const { productId } = z
      .object({ productId: z.uuid().optional() })
      .parse(r.query);
    return {
      items: (
        await db.query(
          "SELECT r.*,a.name AS author_name,o.title FROM commerce_reviews r JOIN commerce_orders o ON o.id=r.order_id JOIN accounts a ON a.id=r.author_id WHERE ($1::text IS NULL OR o.product_id=$1) ORDER BY r.created_at DESC LIMIT 200",
          [productId ?? null],
        )
      ).rows,
    };
  });
  app.post("/api/commerce/reviews", async (r, reply) => {
    const account = user(r, "transaction-reviews"),
      input = z
        .object({
          orderId: z.uuid(),
          rating: z.number().int().min(1).max(5),
          body: z.string().trim().min(1).max(2000),
        })
        .strict()
        .parse(r.body);
    const result = await db.transaction(async (tx) => {
      const o =
        (
          await tx.query<CommerceOrder>(
            "SELECT * FROM commerce_orders WHERE id=$1 FOR UPDATE",
            [input.orderId],
          )
        ).rows[0] || missing();
      if (o.buyer_id !== account.id) denied();
      if (o.status !== "completed") fail("完成交易后才可以评价");
      const row = (
        await tx.query(
          "INSERT INTO commerce_reviews(id,order_id,author_id,rating,body) VALUES($1,$2,$3,$4,$5) ON CONFLICT(order_id) DO NOTHING RETURNING *",
          [randomUUID(), o.id, account.id, input.rating, input.body],
        )
      ).rows[0];
      if (!row) fail("该订单已经评价");
      return row;
    });
    return reply.code(201).send(result);
  });
  app.get("/api/commerce/favorites", async (r) => {
    const account = user(r, "product-favorites");
    return {
      items: (
        await db.query(
          "SELECT p.*,s.owner_id,s.name AS shop_name FROM commerce_favorites f JOIN commerce_products p ON p.id=f.product_id JOIN commerce_shops s ON s.id=p.shop_id WHERE f.user_id=$1 ORDER BY f.created_at DESC LIMIT 200",
          [account.id],
        )
      ).rows,
    };
  });
  app.put("/api/commerce/favorites/:id", async (r) => {
    const account = user(r, "product-favorites"),
      p = await product(id(r));
    if (p.status !== "active") fail("商品已下架");
    await db.query(
      "INSERT INTO commerce_favorites(product_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [p.id, account.id],
    );
    return { ok: true };
  });
  app.delete("/api/commerce/favorites/:id", async (r) => {
    const account = user(r, "product-favorites");
    await db.query(
      "DELETE FROM commerce_favorites WHERE product_id=$1 AND user_id=$2",
      [id(r), account.id],
    );
    return { ok: true };
  });
  app.get("/api/commerce/analytics", async (r) => {
    const account = user(r, "merchant-analytics"),
      own = await shop(account.id);
    const orders = (
      await db.query(
        "SELECT count(*)::int AS total_orders,count(*) FILTER(WHERE status IN ('placed','accepted','ready'))::int AS pending_orders,count(*) FILTER(WHERE status='completed')::int AS completed_orders,COALESCE(sum(total_cents) FILTER(WHERE status='completed'),0)::text AS completed_cents FROM commerce_orders WHERE seller_id=$1",
        [account.id],
      )
    ).rows[0];
    const bookings = (
      await db.query(
        "SELECT count(*) FILTER(WHERE b.status='booked')::int AS upcoming_bookings,count(*) FILTER(WHERE b.status='completed')::int AS completed_bookings FROM commerce_bookings b JOIN commerce_services s ON s.id=b.service_id WHERE s.shop_id=$1",
        [own.id],
      )
    ).rows[0];
    return { ...orders, ...bookings };
  });
}
