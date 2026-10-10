import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { InjectOptions } from "fastify";
import { createRuntime } from "../server/runtime-server.js";
import { resolveModules } from "../packages/modules/src/catalog.js";
import { commerceCatalog } from "../packages/modules/src/commerce-catalog.js";

test("commerce: multimerchant authorization, atomic stock, coupons, idempotency, fulfillment, reviews, bookings and persistence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "atlas-commerce-")),
    modules = resolveModules(commerceCatalog.map((m) => m.moduleId)).map(
      (m) => m.moduleId,
    );
  const config = {
    appId: "commerce-test",
    dataDir: root,
    spec: {
      name: "校园生意",
      description: "多商家交易与服务预约",
      kind: "custom" as const,
      modules,
      features: [],
      primaryColor: "green" as const,
    },
    modules,
    recipes: [],
  };
  let runtime = await createRuntime(config);
  try {
    const register = async (name: string) => {
      const r = await runtime.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: `${name}@commerce.test`,
          name,
          password: "CommercePassword123",
        },
      });
      assert.equal(r.statusCode, 201, r.body);
      return {
        id: r.json().user.id,
        cookie: r.headers["set-cookie"]!.toString().split(";")[0],
      };
    };
    const seller = await register("seller"),
      buyer = await register("buyer"),
      other = await register("other");
    const call = (
      url: string,
      cookie: string,
      method: InjectOptions["method"] = "GET",
      payload?: object,
    ) =>
      runtime.app.inject({
        url: `/api/commerce/${url}`,
        method,
        payload,
        headers: { cookie },
      });
    const shop = await call("shops", seller.cookie, "POST", {
      name: "手作店",
      description: "校园小店",
      location: "南门",
    });
    assert.equal(shop.statusCode, 201, shop.body);
    const create = await call("products", seller.cookie, "POST", {
      title: "纪念帆布袋",
      description: "实测商品",
      category: "手作",
      priceCents: 3900,
      stock: 2,
    });
    assert.equal(create.statusCode, 201, create.body);
    const product = create.json();
    assert.equal(
      (
        await call(`products/${product.id}/stock`, other.cookie, "PUT", {
          stock: 100,
          version: 1,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call(`products/${product.id}`, other.cookie, "PATCH", {
          status: "paused",
        })
      ).statusCode,
      403,
    );
    const coupon = await call("coupons", seller.cookie, "POST", {
      code: "WELCOME10",
      discountCents: 1000,
      minimumCents: 3000,
      maxUses: 1,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal(coupon.statusCode, 201, coupon.body);
    const orderData = {
      productId: product.id,
      expectedPriceCents: 3900,
      quantity: 1,
      requestKey: randomUUID(),
      coupon: "WELCOME10",
    };
    const [a, b] = await Promise.all([
      call("orders", buyer.cookie, "POST", orderData),
      call("orders", buyer.cookie, "POST", orderData),
    ]);
    assert.equal(a.statusCode, 201, a.body);
    assert.equal(a.json().id, b.json().id);
    assert.equal(a.json().total_cents, 2900);
    const order = a.json();
    assert.equal(
      (await call("products", buyer.cookie)).json().items[0].stock,
      1,
    );
    assert.equal(
      (await call("coupons", seller.cookie)).json().items[0].uses,
      1,
    );
    assert.equal(
      (
        await call("orders", other.cookie, "POST", {
          ...orderData,
          requestKey: randomUUID(),
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call("orders", buyer.cookie, "POST", {
          ...orderData,
          quantity: 2,
        })
      ).statusCode,
      409,
    );
    assert.equal((await call("orders", other.cookie)).json().items.length, 0);
    assert.equal(
      (
        await call(`orders/${order.id}/transition`, other.cookie, "POST", {
          action: "cancel",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call(`orders/${order.id}/transition`, buyer.cookie, "POST", {
          action: "accept",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call("reviews", buyer.cookie, "POST", {
          orderId: order.id,
          rating: 5,
          body: "too early",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call(`orders/${order.id}/transition`, seller.cookie, "POST", {
          action: "accept",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await call(`orders/${order.id}/transition`, seller.cookie, "POST", {
          action: "ready",
          note: "南门取货",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await call(`orders/${order.id}/transition`, seller.cookie, "POST", {
          action: "complete",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call(`orders/${order.id}/transition`, buyer.cookie, "POST", {
          action: "cancel",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call(`orders/${order.id}/transition`, buyer.cookie, "POST", {
          action: "complete",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await call("reviews", buyer.cookie, "POST", {
          orderId: order.id,
          rating: 5,
          body: "质量很好",
        })
      ).statusCode,
      201,
    );
    assert.equal(
      (
        await call("reviews", buyer.cookie, "POST", {
          orderId: order.id,
          rating: 4,
          body: "重复",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call("reviews", other.cookie, "POST", {
          orderId: order.id,
          rating: 5,
          body: "伪造",
        })
      ).statusCode,
      403,
    );
    // Two distinct buyers race for the final unit; exactly one reservation succeeds.
    const raced = await Promise.all(
      [buyer, other].map((u) =>
        call("orders", u.cookie, "POST", {
          productId: product.id,
          quantity: 1,
          expectedPriceCents: 3900,
          requestKey: randomUUID(),
        }),
      ),
    );
    assert.deepEqual(raced.map((r) => r.statusCode).sort(), [201, 409]);
    const winner = raced.find((r) => r.statusCode === 201)!.json();
    assert.equal(
      (
        await call(`orders/${winner.id}/transition`, seller.cookie, "POST", {
          action: "cancel",
        })
      ).statusCode,
      200,
    );
    await call(`orders/${winner.id}/transition`, seller.cookie, "POST", {
      action: "cancel",
    });
    assert.equal(
      (await call("products", buyer.cookie)).json().items[0].stock,
      1,
    );
    assert.equal(
      (
        await call(`products/${product.id}/stock`, seller.cookie, "PUT", {
          stock: 10,
          version: 1,
        })
      ).statusCode,
      409,
    );
    await call(`products/${product.id}`, seller.cookie, "PATCH", {
      status: "active",
      priceCents: 4900,
    });
    assert.equal(
      (
        await call("orders", buyer.cookie, "POST", {
          productId: product.id,
          quantity: 1,
          expectedPriceCents: 3900,
          requestKey: randomUUID(),
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await call(`favorites/${product.id}`, buyer.cookie, "PUT")).statusCode,
      200,
    );
    assert.equal(
      (await call("favorites", buyer.cookie)).json().items.length,
      1,
    );
    assert.equal(
      (await call("favorites", other.cookie)).json().items.length,
      0,
    );
    const svc = await call("services", seller.cookie, "POST", {
      title: "毕业摄影",
      description: "半小时",
      priceCents: 9900,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      capacity: 1,
    });
    assert.equal(svc.statusCode, 201, svc.body);
    const reservations = await Promise.all(
      [buyer, other].map((u) =>
        call(`services/${svc.json().id}/book`, u.cookie, "POST", {}),
      ),
    );
    assert.deepEqual(reservations.map((r) => r.statusCode).sort(), [201, 409]);
    const booked = reservations.find((r) => r.statusCode === 201)!.json(),
      booker = booked.user_id === buyer.id ? buyer : other;
    assert.equal(
      (
        await call(`bookings/${booked.id}/transition`, seller.cookie, "POST", {
          action: "complete",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call(`bookings/${booked.id}/transition`, booker.cookie, "POST", {
          action: "complete",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call(`bookings/${booked.id}/transition`, booker.cookie, "POST", {
          action: "cancel",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await call(`services/${svc.json().id}/book`, booker.cookie, "POST", {}))
        .statusCode,
      201,
    );
    await runtime.db.query(
      "UPDATE commerce_services SET starts_at=now()-interval '1 minute' WHERE id=$1",
      [svc.json().id],
    );
    assert.equal(
      (
        await call(`bookings/${booked.id}/transition`, seller.cookie, "POST", {
          action: "complete",
        })
      ).statusCode,
      200,
    );
    const metrics = (await call("analytics", seller.cookie)).json();
    assert.equal(metrics.completed_cents, "2900");
    assert.equal(metrics.completed_bookings, 1);
    assert.ok(
      (await runtime.db.query("SELECT id FROM notifications")).rows.length > 0,
    );
    await runtime.app.close();
    runtime = await createRuntime(config);
    assert.equal(
      (await call("orders", buyer.cookie))
        .json()
        .items.find((o: { id: string }) => o.id === order.id).status,
      "completed",
    );
    assert.equal(
      (await call("reviews", buyer.cookie)).json().items[0].body,
      "质量很好",
    );
    await runtime.db.query(
      "INSERT INTO commerce_products(id,shop_id,title,description,category,price_cents,stock,status) SELECT 'quota-'||i,$1,'quota','','test',100,0,'paused' FROM generate_series(1,499) i",
      [shop.json().id],
    );
    assert.equal(
      (
        await call("products", seller.cookie, "POST", {
          title: "over quota",
          description: "",
          category: "test",
          priceCents: 100,
          stock: 1,
        })
      ).statusCode,
      429,
    );
  } finally {
    await runtime.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
