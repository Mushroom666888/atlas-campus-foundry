import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../contracts/src/index.js";
import {
  profileInput,
  productInput,
  postInput,
  replyInput,
} from "../../contracts/src/community.js";
import { requireUser } from "../../../server/auth.js";
import type { Database } from "../../../server/db.js";
import { withQuota } from "./quota.js";

export function registerCommunity(
  app: FastifyInstance,
  db: Database,
  modules?: string[],
) {
  if (modules)
    app.addHook("preHandler", async (request) => {
      const route = request.routeOptions.url || "";
      if (!route.startsWith("/api/community/")) return;
      const required = route.includes("/directory")
        ? "member-directory"
        : route.includes("/profile")
          ? "creator-profiles"
          : route.includes("/products")
            ? "product-showcase"
            : "discussion-forum";
      if (!modules.includes(required))
        throw new AppError(
          409,
          "MODULE_NOT_INSTALLED",
          `未安装模块：${required}`,
        );
    });
  app.get("/api/community/directory", async (request) => {
    const { q, school, page } = z
      .object({
        q: z.string().max(100).default(""),
        school: z.string().max(100).default(""),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .parse(request.query);
    const rows = (
      await db.query(
        `SELECT p.user_id AS id,p.display_name,p.school,p.bio,p.tags,a.created_at FROM creator_profiles p JOIN accounts a ON a.id=p.user_id
      WHERE ($1='' OR strpos(lower(p.display_name||' '||p.bio||' '||p.tags::text),lower($1))>0) AND ($2='' OR strpos(lower(p.school),lower($2))>0)
      ORDER BY p.updated_at DESC,p.user_id LIMIT 21 OFFSET $3`,
        [q, school, (page - 1) * 20],
      )
    ).rows;
    return { items: rows.slice(0, 20), page, hasMore: rows.length > 20 };
  });
  const id = (request: FastifyRequest) =>
    z.object({ id: z.uuid() }).parse(request.params).id;
  const feedQuery = z.object({
    q: z.string().trim().max(100).default(""),
    category: z.string().max(30).default(""),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    owner: z.uuid().optional(),
  });
  const writeLimit = {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  };
  const author =
    "COALESCE(cp.display_name,a.name) AS author_name,COALESCE(cp.school,'') AS school";
  async function owned(
    table: "community_posts" | "community_replies" | "creator_products",
    resourceId: string,
    request: FastifyRequest,
    moderate = false,
  ) {
    const user = requireUser(request),
      column = table === "creator_products" ? "owner_id" : "author_id";
    const row = (
      await db.query(`SELECT * FROM ${table} WHERE id=$1`, [resourceId])
    ).rows[0];
    if (!row) throw new AppError(404, "NOT_FOUND", "内容不存在或已删除");
    if (row[column] !== user.id && !(moderate && user.role === "admin"))
      throw new AppError(403, "FORBIDDEN", "只有作者可以修改此内容");
    return row;
  }
  app.get("/api/community/profiles/:id", async (request) => {
    const userId = id(request);
    const profile = (
      await db.query(
        `SELECT a.id,COALESCE(p.display_name,a.name) AS display_name,COALESCE(p.school,'') AS school,
      COALESCE(p.bio,'') AS bio,COALESCE(p.tags,'[]'::jsonb) AS tags,a.created_at
      FROM accounts a LEFT JOIN creator_profiles p ON p.user_id=a.id WHERE a.id=$1`,
        [userId],
      )
    ).rows[0];
    if (!profile) throw new AppError(404, "NOT_FOUND", "创作者不存在");
    return { profile };
  });
  app.put("/api/community/profile", writeLimit, async (request) => {
    const user = requireUser(request),
      input = profileInput.parse(request.body);
    return db.transaction(async (tx) => {
      const result = await tx.query(
        `INSERT INTO creator_profiles(user_id,display_name,school,bio,tags) VALUES($1,$2,$3,$4,$5::jsonb)
        ON CONFLICT(user_id) DO UPDATE SET display_name=$2,school=$3,bio=$4,tags=$5::jsonb,updated_at=now() RETURNING *`,
        [
          user.id,
          input.displayName,
          input.school,
          input.bio,
          JSON.stringify(input.tags),
        ],
      );
      await tx.query(
        "INSERT INTO audit_log(actor_id,action,resource_id) VALUES($1,'community.profile.updated',$1)",
        [user.id],
      );
      return result.rows[0];
    });
  });
  app.get("/api/community/products", async (request) => {
    const query = feedQuery.parse(request.query);
    const rows = (
      await db.query(
        `SELECT p.*,${author} FROM creator_products p JOIN accounts a ON a.id=p.owner_id LEFT JOIN creator_profiles cp ON cp.user_id=a.id
      WHERE ($1='' OR strpos(lower(p.name||' '||p.tagline||' '||p.tags::text),lower($1))>0)
      AND ($2='' OR p.category=$2) AND ($3::text IS NULL OR p.owner_id=$3)
      ORDER BY p.created_at DESC,p.id LIMIT 21 OFFSET $4`,
        [query.q, query.category, query.owner ?? null, (query.page - 1) * 20],
      )
    ).rows;
    return {
      items: rows.slice(0, 20),
      page: query.page,
      hasMore: rows.length > 20,
    };
  });
  app.get("/api/community/products/:id", async (request) => {
    const product = (
      await db.query(
        `SELECT p.*,${author} FROM creator_products p JOIN accounts a ON a.id=p.owner_id LEFT JOIN creator_profiles cp ON cp.user_id=a.id WHERE p.id=$1`,
        [id(request)],
      )
    ).rows[0];
    if (!product) throw new AppError(404, "NOT_FOUND", "产品不存在或已下架");
    return { product };
  });
  app.post("/api/community/products", writeLimit, async (request, reply) => {
    const user = requireUser(request),
      input = productInput.parse(request.body),
      productId = randomUUID();
    await withQuota(db, "creator_products", user.id, (tx) =>
      tx.query(
        `INSERT INTO creator_products(id,owner_id,name,tagline,description,url,category,stage,tags) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [
          productId,
          user.id,
          input.name,
          input.tagline,
          input.description,
          input.url,
          input.category,
          input.stage,
          JSON.stringify(input.tags),
        ],
      ),
    );
    return reply.code(201).send({ id: productId });
  });
  app.put("/api/community/products/:id", writeLimit, async (request) => {
    const productId = id(request);
    await owned("creator_products", productId, request);
    const input = productInput.parse(request.body);
    await db.query(
      `UPDATE creator_products SET name=$2,tagline=$3,description=$4,url=$5,category=$6,stage=$7,tags=$8::jsonb,updated_at=now() WHERE id=$1`,
      [
        productId,
        input.name,
        input.tagline,
        input.description,
        input.url,
        input.category,
        input.stage,
        JSON.stringify(input.tags),
      ],
    );
    return { ok: true };
  });
  app.get("/api/community/posts", async (request) => {
    const query = feedQuery.parse(request.query);
    const rows = (
      await db.query(
        `SELECT p.*,${author},(SELECT count(*)::int FROM community_replies r WHERE r.post_id=p.id) AS reply_count
      FROM community_posts p JOIN accounts a ON a.id=p.author_id LEFT JOIN creator_profiles cp ON cp.user_id=a.id
      WHERE ($1='' OR strpos(lower(p.title||' '||p.body||' '||p.tags::text),lower($1))>0)
      AND ($2='' OR p.category=$2) AND ($3::text IS NULL OR p.author_id=$3)
      ORDER BY p.created_at DESC,p.id LIMIT 21 OFFSET $4`,
        [query.q, query.category, query.owner ?? null, (query.page - 1) * 20],
      )
    ).rows;
    return {
      items: rows.slice(0, 20),
      page: query.page,
      hasMore: rows.length > 20,
    };
  });
  app.post("/api/community/posts", writeLimit, async (request, reply) => {
    const user = requireUser(request),
      input = postInput.parse(request.body),
      postId = randomUUID();
    await withQuota(db, "community_posts", user.id, (tx) =>
      tx.query(
        "INSERT INTO community_posts(id,author_id,title,body,category,tags) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
        [
          postId,
          user.id,
          input.title,
          input.body,
          input.category,
          JSON.stringify(input.tags),
        ],
      ),
    );
    return reply.code(201).send({ id: postId });
  });
  app.get("/api/community/posts/:id", async (request) => {
    const post = (
      await db.query(
        `SELECT p.*,${author} FROM community_posts p JOIN accounts a ON a.id=p.author_id LEFT JOIN creator_profiles cp ON cp.user_id=a.id WHERE p.id=$1`,
        [id(request)],
      )
    ).rows[0];
    if (!post) throw new AppError(404, "NOT_FOUND", "讨论不存在或已删除");
    return { post };
  });
  app.put("/api/community/posts/:id", writeLimit, async (request) => {
    const postId = id(request);
    await owned("community_posts", postId, request);
    const input = postInput.parse(request.body);
    await db.query(
      "UPDATE community_posts SET title=$2,body=$3,category=$4,tags=$5::jsonb,updated_at=now() WHERE id=$1",
      [
        postId,
        input.title,
        input.body,
        input.category,
        JSON.stringify(input.tags),
      ],
    );
    return { ok: true };
  });
  app.get("/api/community/posts/:id/replies", async (request) => {
    const postId = id(request),
      { page } = feedQuery.parse(request.query);
    if (
      !(await db.query("SELECT id FROM community_posts WHERE id=$1", [postId]))
        .rows.length
    )
      throw new AppError(404, "NOT_FOUND", "讨论不存在");
    const rows = (
      await db.query(
        `SELECT r.*,${author} FROM community_replies r JOIN accounts a ON a.id=r.author_id LEFT JOIN creator_profiles cp ON cp.user_id=a.id
      WHERE r.post_id=$1 ORDER BY r.created_at,r.id LIMIT 21 OFFSET $2`,
        [postId, (page - 1) * 20],
      )
    ).rows;
    return { items: rows.slice(0, 20), page, hasMore: rows.length > 20 };
  });
  app.post(
    "/api/community/posts/:id/replies",
    writeLimit,
    async (request, reply) => {
      const user = requireUser(request),
        input = replyInput.parse(request.body),
        postId = id(request),
        replyId = randomUUID();
      await withQuota(db, "community_replies", user.id, async (tx) => {
        if (
          !(
            await tx.query(
              "SELECT id FROM community_posts WHERE id=$1 FOR KEY SHARE",
              [postId],
            )
          ).rows.length
        )
          throw new AppError(404, "NOT_FOUND", "讨论不存在");
        await tx.query(
          "INSERT INTO community_replies(id,post_id,author_id,body) VALUES($1,$2,$3,$4)",
          [replyId, postId, user.id, input.body],
        );
      });
      return reply.code(201).send({ id: replyId });
    },
  );
  for (const [route, table] of [
    ["products", "creator_products"],
    ["posts", "community_posts"],
    ["replies", "community_replies"],
  ] as const) {
    app.delete(`/api/community/${route}/:id`, writeLimit, async (request) => {
      const resourceId = id(request);
      await owned(table, resourceId, request, true);
      await db.transaction(async (tx) => {
        await tx.query(`DELETE FROM ${table} WHERE id=$1`, [resourceId]);
        await tx.query(
          "INSERT INTO audit_log(actor_id,action,resource_id) VALUES($1,$2,$3)",
          [requireUser(request).id, `community.${route}.deleted`, resourceId],
        );
      });
      return { ok: true };
    });
  }
}
