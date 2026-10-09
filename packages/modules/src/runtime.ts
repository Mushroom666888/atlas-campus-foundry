import type { FastifyInstance, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import {
  AppError,
  entitySchema,
  type Entity,
  type ProductSpec,
  type FeatureRecipe,
} from "../../contracts/src/index.js";
import type { Database, SQL } from "../../../server/db.js";
import { requireUser, hashToken } from "../../../server/auth.js";
import { emailProvider, OpenStreetMap } from "../../../server/providers.js";

export type RuntimeConfig = {
  appId: string;
  spec: ProductSpec;
  modules: string[];
  recipes: FeatureRecipe[];
  dataDir: string;
  streamHeartbeatMs?: number;
};
const kindModule: Record<string, string> = {
  event: "events",
  listing: "content",
  profile: "profiles",
  group: "groups",
  location: "campus",
  school: "campus",
  course: "groups",
  post: "content",
};
export async function registerRuntime(
  app: FastifyInstance,
  db: Database,
  config: RuntimeConfig,
) {
  const subscribers = new Map<string, Set<(event: unknown) => void>>();
  const closeStreams = new Set<() => void>();
  app.addHook("preClose", async () => {
    for (const close of closeStreams) close();
  });
  function enabled(id: string) {
    if (!config.modules.includes(id))
      throw new AppError(
        409,
        "MODULE_NOT_INSTALLED",
        `Module not installed: ${id}`,
      );
  }
  function broadcast(user: string, event: unknown) {
    for (const emit of subscribers.get(user) ?? []) emit(event);
  }
  async function entity(id: string, sql: SQL = db): Promise<Entity> {
    const result = (
      await sql.query<Entity>("SELECT * FROM entities WHERE id=$1", [id])
    ).rows[0];
    if (!result) throw new AppError(404, "NOT_FOUND", "记录不存在");
    return result;
  }
  async function notify(sql: SQL, userId: string, body: string) {
    if (config.modules.includes("notifications"))
      await sql.query(
        "INSERT INTO notifications(id,user_id,body) VALUES($1,$2,$3)",
        [randomUUID(), userId, body],
      );
  }
  const paramsId = (request: FastifyRequest) =>
    (request.params as { id: string }).id;
  async function validateData(
    input: z.infer<typeof entitySchema>,
    userId: string,
  ) {
    if (input.kind === "location")
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }).parse(input.data);
    if (input.kind === "event" || input.kind === "group") {
      if (input.data.capacity !== undefined)
        z.number().int().min(1).max(100000).parse(input.data.capacity);
    }
    if (input.kind === "listing" && input.data.price !== undefined)
      z.number().min(0).max(1000000).parse(input.data.price);
    if (input.data.imageId) {
      z.uuid().parse(input.data.imageId);
      if (
        !(
          await db.query("SELECT id FROM uploads WHERE id=$1 AND owner_id=$2", [
            input.data.imageId,
            userId,
          ])
        ).rows.length
      )
        throw new AppError(403, "UPLOAD_DENIED", "只能使用自己的图片");
    }
    if (input.data.locationId) {
      const location = await entity(z.uuid().parse(input.data.locationId));
      if (location.kind !== "location")
        throw new AppError(400, "INVALID_LOCATION", "请选择校园地点");
    }
  }
  app.get("/api/application", async () => ({
    appId: config.appId,
    spec: config.spec,
    modules: config.modules,
    recipes: config.recipes,
    emailProvider: process.env.EMAIL_PROVIDER || "local-outbox",
  }));
  app.get("/api/entities", async (request) => {
    requireUser(request);
    const query = z
      .object({
        kind: z
          .enum([
            "event",
            "listing",
            "profile",
            "group",
            "location",
            "course",
            "post",
            "school",
          ])
          .optional(),
        q: z.string().max(150).default(""),
        status: z.enum(["active", "sold", "closed"]).optional(),
      })
      .parse(request.query);
    if (query.kind) enabled(kindModule[query.kind]);
    if (query.q) enabled("search");
    const rows = (
      await db.query<Entity>(
        "SELECT * FROM entities WHERE ($1::text IS NULL OR kind=$1) AND ($2='' OR title ILIKE '%' || $2 || '%' OR body ILIKE '%' || $2 || '%' OR coalesce(data->>'course','') ILIKE '%' || $2 || '%' OR coalesce(data->>'interests','') ILIKE '%' || $2 || '%') AND ($3::text IS NULL OR status=$3) ORDER BY created_at DESC LIMIT 200",
        [query.kind ?? null, query.q, query.status ?? null],
      )
    ).rows;
    return { items: rows };
  });
  app.post("/api/entities", async (request, reply) => {
    const user = requireUser(request);
    const input = entitySchema.parse(request.body);
    enabled(kindModule[input.kind]);
    await validateData(input, user.id);
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO entities(id,kind,owner_id,title,body,data) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          input.kind,
          user.id,
          input.title,
          input.body,
          JSON.stringify(input.data),
        ],
      );
      await tx.query("INSERT INTO domain_events(type,payload) VALUES($1,$2)", [
        `${input.kind}.created`,
        JSON.stringify({ id, actor: user.id }),
      ]);
    });
    return reply.code(201).send(await entity(id));
  });
  app.get("/api/entities/:id", async (request) => {
    requireUser(request);
    const item = await entity(paramsId(request));
    enabled(kindModule[item.kind]);
    return item;
  });
  app.patch("/api/entities/:id", async (request) => {
    const user = requireUser(request);
    const item = await entity(paramsId(request));
    enabled(kindModule[item.kind]);
    if (item.owner_id !== user.id)
      throw new AppError(403, "OWNER_REQUIRED", "只有创建者可以修改");
    const patch = z
      .object({
        title: z.string().min(1).max(160).optional(),
        body: z.string().max(10000).optional(),
        data: z.record(z.string(), z.unknown()).optional(),
        status: z.enum(["active", "sold", "closed"]).optional(),
      })
      .strict()
      .parse(request.body);
    const next = {
      kind: item.kind as z.infer<typeof entitySchema>["kind"],
      title: patch.title ?? item.title,
      body: patch.body ?? item.body,
      data: patch.data ?? item.data,
    };
    await validateData(next, user.id);
    await db.query(
      "UPDATE entities SET title=$2,body=$3,data=$4,status=$5,updated_at=now() WHERE id=$1",
      [
        item.id,
        next.title,
        next.body,
        JSON.stringify(next.data),
        patch.status ?? item.status,
      ],
    );
    return entity(item.id);
  });
  app.get("/api/entities/:id/members", async (request) => {
    const user = requireUser(request);
    const item = await entity(paramsId(request));
    enabled(kindModule[item.kind]);
    const mine =
      (
        await db.query(
          "SELECT status,position FROM memberships WHERE entity_id=$1 AND user_id=$2",
          [item.id, user.id],
        )
      ).rows[0] ?? null;
    const counts = (
      await db.query<{ status: string; count: number }>(
        "SELECT status,count(*)::integer AS count FROM memberships WHERE entity_id=$1 GROUP BY status",
        [item.id],
      )
    ).rows;
    const members =
      item.owner_id === user.id
        ? (
            await db.query(
              "SELECT m.user_id,a.name,m.status,m.position FROM memberships m JOIN accounts a ON a.id=m.user_id WHERE entity_id=$1 ORDER BY position",
              [item.id],
            )
          ).rows
        : [];
    return { mine, counts, members };
  });
  app.post("/api/entities/:id/join", async (request) => {
    const user = requireUser(request);
    const id = paramsId(request);
    return db.transaction(async (tx) => {
      const item = (
        await tx.query<Entity>(
          "SELECT * FROM entities WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!item) throw new AppError(404, "NOT_FOUND", "记录不存在");
      enabled(kindModule[item.kind]);
      if (!["event", "group"].includes(item.kind) || item.status !== "active")
        throw new AppError(409, "NOT_JOINABLE", "当前不可报名");
      const existing = (
        await tx.query(
          "SELECT status,position FROM memberships WHERE entity_id=$1 AND user_id=$2",
          [id, user.id],
        )
      ).rows[0];
      if (existing) return existing;
      const count = (
        await tx.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM memberships WHERE entity_id=$1 AND status='joined'",
          [id],
        )
      ).rows[0].count;
      const full =
        typeof item.data.capacity === "number" && count >= item.data.capacity;
      const recipe = config.recipes.find((r) => r.entity === item.kind);
      if (full && !recipe) throw new AppError(409, "CAPACITY_FULL", "人数已满");
      const status = full ? "waiting" : "joined";
      const result = (
        await tx.query(
          "INSERT INTO memberships(entity_id,user_id,status) VALUES($1,$2,$3) RETURNING status,position",
          [id, user.id, status],
        )
      ).rows[0];
      await notify(
        tx,
        user.id,
        `${item.title}：${full ? "已加入候补队列" : "报名成功"}`,
      );
      await notify(
        tx,
        item.owner_id,
        `${user.name} ${full ? "候补" : "报名"}了 ${item.title}`,
      );
      await tx.query("INSERT INTO domain_events(type,payload) VALUES($1,$2)", [
        `${item.kind}.registration`,
        JSON.stringify({ entityId: id, userId: user.id, status }),
      ]);
      return result;
    });
  });
  app.post("/api/entities/:id/leave", async (request) => {
    const user = requireUser(request);
    const id = paramsId(request);
    return db.transaction(async (tx) => {
      const item = (
        await tx.query<Entity>(
          "SELECT * FROM entities WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!item) throw new AppError(404, "NOT_FOUND", "记录不存在");
      enabled(kindModule[item.kind]);
      const previous = (
        await tx.query<{ status: string }>(
          "DELETE FROM memberships WHERE entity_id=$1 AND user_id=$2 RETURNING status",
          [id, user.id],
        )
      ).rows[0];
      const recipe = config.recipes.find((r) => r.entity === item.kind);
      if (previous)
        await tx.query(
          "INSERT INTO domain_events(type,payload) VALUES($1,$2)",
          [
            "membership.left",
            JSON.stringify({
              entityId: id,
              userId: user.id,
              previousStatus: previous.status,
            }),
          ],
        );
      if (previous?.status === "joined" && recipe) {
        const waiting = (
          await tx.query<{ user_id: string }>(
            "SELECT user_id FROM memberships WHERE entity_id=$1 AND status='waiting' ORDER BY position LIMIT 1",
            [id],
          )
        ).rows[0];
        if (waiting) {
          await tx.query(
            "UPDATE memberships SET status='joined' WHERE entity_id=$1 AND user_id=$2",
            [id, waiting.user_id],
          );
          if (recipe.notify)
            await notify(
              tx,
              waiting.user_id,
              `${item.title}：已按候补顺序递补成功`,
            );
          await tx.query(
            "INSERT INTO domain_events(type,payload) VALUES($1,$2)",
            [
              "waitlist.promoted",
              JSON.stringify({ entityId: id, userId: waiting.user_id }),
            ],
          );
        }
      }
      return { ok: true };
    });
  });
  app.get("/api/notifications", async (request) => {
    const user = requireUser(request);
    enabled("notifications");
    return {
      items: (
        await db.query(
          "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
          [user.id],
        )
      ).rows,
    };
  });
  app.post("/api/notifications/:id/read", async (request) => {
    const user = requireUser(request);
    enabled("notifications");
    const result = await db.query(
      "UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2 RETURNING id",
      [paramsId(request), user.id],
    );
    if (!result.rows.length) throw new AppError(404, "NOT_FOUND", "通知不存在");
    return { ok: true };
  });
  app.get("/api/people", async (request) => {
    requireUser(request);
    enabled("chat");
    return {
      items: (
        await db.query("SELECT id,name FROM accounts ORDER BY name LIMIT 200")
      ).rows,
    };
  });
  async function conversationMember(id: string, userId: string) {
    if (
      !(
        await db.query(
          "SELECT user_id FROM conversation_members WHERE conversation_id=$1 AND user_id=$2",
          [id, userId],
        )
      ).rows.length
    )
      throw new AppError(404, "NOT_FOUND", "会话不存在");
  }
  app.post("/api/conversations", async (request, reply) => {
    const user = requireUser(request);
    enabled("chat");
    const input = z
      .object({
        title: z.string().min(1).max(100),
        members: z.array(z.uuid()).min(1).max(50),
        entityId: z.uuid().optional(),
      })
      .parse(request.body);
    const members = [...new Set([user.id, ...input.members])];
    if (
      (
        await db.query("SELECT id FROM accounts WHERE id=ANY($1::text[])", [
          members,
        ])
      ).rows.length !== members.length
    )
      throw new AppError(400, "INVALID_MEMBER", "成员必须属于当前应用");
    if (input.entityId) await entity(input.entityId);
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO conversations(id,title,created_by,entity_id) VALUES($1,$2,$3,$4)",
        [id, input.title, user.id, input.entityId ?? null],
      );
      for (const member of members)
        await tx.query(
          "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)",
          [id, member],
        );
    });
    return reply.code(201).send({ id, title: input.title });
  });
  app.get("/api/conversations", async (request) => {
    const user = requireUser(request);
    enabled("chat");
    return {
      items: (
        await db.query(
          "SELECT c.* FROM conversations c JOIN conversation_members m ON c.id=m.conversation_id WHERE m.user_id=$1 ORDER BY c.created_at DESC",
          [user.id],
        )
      ).rows,
    };
  });
  app.get("/api/conversations/:id/messages", async (request) => {
    const user = requireUser(request);
    enabled("chat");
    await conversationMember(paramsId(request), user.id);
    return {
      items: (
        await db.query(
          "SELECT m.*,a.name AS sender_name FROM messages m JOIN accounts a ON a.id=m.sender_id WHERE conversation_id=$1 ORDER BY created_at LIMIT 500",
          [paramsId(request)],
        )
      ).rows,
    };
  });
  app.post("/api/conversations/:id/messages", async (request, reply) => {
    const user = requireUser(request);
    enabled("chat");
    const id = paramsId(request);
    await conversationMember(id, user.id);
    const { body } = z
      .object({ body: z.string().min(1).max(4000) })
      .parse(request.body);
    const message = {
      id: randomUUID(),
      conversation_id: id,
      sender_id: user.id,
      body,
      created_at: new Date().toISOString(),
    };
    await db.query(
      "INSERT INTO messages(id,conversation_id,sender_id,body) VALUES($1,$2,$3,$4)",
      [message.id, id, user.id, body],
    );
    for (const member of (
      await db.query<{ user_id: string }>(
        "SELECT user_id FROM conversation_members WHERE conversation_id=$1",
        [id],
      )
    ).rows)
      broadcast(member.user_id, { type: "message", ...message });
    return reply.code(201).send(message);
  });
  app.get("/api/stream", async (request, reply) => {
    const user = requireUser(request);
    enabled("chat");
    if ((subscribers.get(user.id)?.size ?? 0) >= 5)
      throw new AppError(429, "STREAM_LIMIT", "Too many streams");
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    });
    const emit = (event: unknown) =>
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    const set = subscribers.get(user.id) ?? new Set();
    set.add(emit);
    subscribers.set(user.id, set);
    emit({ type: "connected" });
    const close = () => reply.raw.end();
    closeStreams.add(close);
    let checking = false;
    const timer = setInterval(() => {
      if (checking) return;
      checking = true;
      void db
        .query(
          "SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()",
          [request.sessionHash],
        )
        .then((result) => {
          if (!result.rows.length) close();
          else reply.raw.write(": keepalive\n\n");
        })
        .catch(close)
        .finally(() => {
          checking = false;
        });
    }, config.streamHeartbeatMs ?? 15000);
    request.raw.on("close", () => {
      clearInterval(timer);
      closeStreams.delete(close);
      set.delete(emit);
      if (!set.size) subscribers.delete(user.id);
    });
  });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  });
  app.post("/api/uploads", async (request, reply) => {
    const user = requireUser(request);
    enabled("media");
    const quota = (
      await db.query<{ size: number }>(
        "SELECT coalesce(sum(size),0)::integer AS size FROM uploads WHERE owner_id=$1",
        [user.id],
      )
    ).rows[0].size;
    if (quota > 45 * 1024 * 1024)
      throw new AppError(413, "STORAGE_QUOTA", "图片额度为 50 MB");
    const file = await request.file();
    if (!file) throw new AppError(400, "FILE_REQUIRED", "请选择图片");
    const source = await file.toBuffer();
    let buffer: Buffer;
    try {
      buffer = await sharp(source, { limitInputPixels: 16_000_000 })
        .rotate()
        .resize({
          width: 1800,
          height: 1800,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp()
        .toBuffer();
    } catch {
      throw new AppError(400, "INVALID_IMAGE", "仅支持有效的图片文件");
    }
    const id = randomUUID();
    const filename = `${id}.webp`;
    const folder = path.join(config.dataDir, "uploads");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, filename), buffer);
    try {
      await db.query(
        "INSERT INTO uploads(id,owner_id,mime,size,filename) VALUES($1,$2,$3,$4,$5)",
        [id, user.id, "image/webp", buffer.length, filename],
      );
    } catch (error) {
      await rm(path.join(folder, filename), { force: true });
      throw error;
    }
    return reply
      .code(201)
      .send({ id, url: `/api/uploads/${id}`, size: buffer.length });
  });
  app.get("/api/uploads/:id", async (request, reply) => {
    requireUser(request);
    enabled("media");
    const row = (
      await db.query<{ filename: string }>(
        "SELECT filename FROM uploads WHERE id=$1",
        [paramsId(request)],
      )
    ).rows[0];
    if (!row) throw new AppError(404, "NOT_FOUND", "图片不存在");
    return reply
      .header("Cache-Control", "private,max-age=3600")
      .type("image/webp")
      .send(await readFile(path.join(config.dataDir, "uploads", row.filename)));
  });
  app.get("/api/locations/:id/map", async (request) => {
    requireUser(request);
    enabled("campus");
    const item = await entity(paramsId(request));
    if (item.kind !== "location")
      throw new AppError(400, "INVALID_LOCATION", "不是地点");
    return {
      url: new OpenStreetMap().url(
        Number(item.data.latitude),
        Number(item.data.longitude),
      ),
      attribution: "© OpenStreetMap contributors",
    };
  });
  app.post("/api/schools/:id/join", async (request) => {
    const user = requireUser(request);
    enabled("campus");
    const item = await entity(paramsId(request));
    if (item.kind !== "school")
      throw new AppError(400, "INVALID_SCHOOL", "不是学校");
    await db.query(
      "INSERT INTO school_memberships(school_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [item.id, user.id],
    );
    return { verification: "self-declared" };
  });
  app.post(
    "/api/auth/verify-email/request",
    { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
    async (request) => {
      const user = requireUser(request);
      const token = randomBytes(32).toString("base64url");
      await db.query(
        "INSERT INTO verification_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
        [hashToken(token), user.id],
      );
      const result = await emailProvider(config.dataDir).send(
        user.email,
        "Campus email verification",
        `Verification token: ${token}`,
      );
      return {
        ...result,
        message:
          result.provider === "local-outbox"
            ? "验证邮件已写入本地 outbox；尚未发送到真实邮箱"
            : "验证邮件已发送",
      };
    },
  );
  app.post("/api/auth/verify-email", async (request) => {
    const user = requireUser(request);
    const { token } = z
      .object({ token: z.string().min(20).max(100) })
      .parse(request.body);
    await db.transaction(async (tx) => {
      const row = (
        await tx.query(
          "DELETE FROM verification_tokens WHERE token_hash=$1 AND user_id=$2 AND expires_at>now() RETURNING user_id",
          [hashToken(token), user.id],
        )
      ).rows[0];
      if (!row) throw new AppError(400, "INVALID_TOKEN", "验证码无效或过期");
      await tx.query("UPDATE accounts SET verified=true WHERE id=$1", [
        user.id,
      ]);
    });
    return { verified: true, scope: "email-only-not-university-sso" };
  });
}
