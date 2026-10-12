import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError, type PublicUser } from "../../contracts/src/index.js";
import {
  campusSchemas,
  campusCollectionSchema,
  affiliationSchema,
  eventLocationSchema,
  type CampusRecord,
  type CampusCollection,
} from "../../contracts/src/campus.js";
import type { Database, SQL } from "../../../server/db.js";
import { requireUser } from "../../../server/auth.js";

// Identifiers come exclusively from this allowlist, never from client SQL fragments.
const tables: Record<CampusCollection, string> = {
  universities: "campus_universities",
  campuses: "campus_campuses",
  buildings: "campus_buildings",
  venues: "campus_venues",
  courses: "campus_courses",
  clubs: "campus_clubs",
};
export function registerCampus(
  app: FastifyInstance,
  db: Database,
  modules: string[],
) {
  function enabled() {
    if (!modules.includes("campus"))
      throw new AppError(
        409,
        "MODULE_NOT_INSTALLED",
        "Module not installed: campus",
      );
  }
  async function managed(sql: SQL, university: string, user: PublicUser) {
    const school = (
      await sql.query<CampusRecord>(
        "SELECT * FROM campus_universities WHERE id=$1 FOR UPDATE",
        [university],
      )
    ).rows[0];
    if (!school) throw new AppError(404, "UNIVERSITY_NOT_FOUND", "学校不存在");
    if (school.owner_id !== user.id && user.role !== "admin")
      throw new AppError(
        403,
        "CAMPUS_OWNER_REQUIRED",
        "只有学校资料创建者或管理员可以维护",
      );
    return school;
  }
  async function relation(
    sql: SQL,
    table:
      "campus_campuses" | "campus_buildings" | "campus_venues" | "campus_clubs",
    id: unknown,
    university: string,
    campus?: unknown,
  ) {
    if (!id) return;
    const record = (
      await sql.query<CampusRecord>(`SELECT * FROM ${table} WHERE id=$1`, [id])
    ).rows[0];
    if (
      !record ||
      record.university_id !== university ||
      (campus && record.campus_id !== campus)
    )
      throw new AppError(
        422,
        "CAMPUS_RELATION_MISMATCH",
        "关联记录必须属于同一学校和校区",
      );
  }
  async function audit(sql: SQL, type: string, actor: string, detail: unknown) {
    await sql.query("INSERT INTO domain_events(type,payload) VALUES($1,$2)", [
      type,
      JSON.stringify({ actor, detail }),
    ]);
  }
  app.get("/api/campus/contracts", async (request) => {
    requireUser(request);
    enabled();
    return {
      schemas: Object.fromEntries(
        Object.entries(campusSchemas).map(([key, schema]) => [
          key,
          z.toJSONSchema(schema),
        ]),
      ),
      affiliation: z.toJSONSchema(affiliationSchema),
      eventLocation: z.toJSONSchema(eventLocationSchema),
    };
  });
  app.get("/api/campus/:collection", async (request) => {
    requireUser(request);
    enabled();
    const { collection } = z
      .object({ collection: campusCollectionSchema })
      .parse(request.params);
    const input = z
      .object({
        q: z.string().max(150).default(""),
        universityId: z.uuid().optional(),
        campusId: z.uuid().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).max(100000).default(0),
      })
      .parse(request.query);
    const table = tables[collection];
    const columns = ["universities", "campuses"].includes(collection)
      ? "NULL::text"
      : "r.campus_id";
    const school = collection === "universities" ? "r.id" : "r.university_id";
    const where = `WHERE r.name ILIKE '%' || $1 || '%' AND ($2::text IS NULL OR ${school}=$2) AND ($3::text IS NULL OR ${columns}=$3)`;
    const args = [input.q, input.universityId ?? null, input.campusId ?? null];
    const items = (
      await db.query(
        `SELECT r.*,u.owner_id,u.name AS university_name FROM ${table} r JOIN campus_universities u ON u.id=${school} ${where} ORDER BY lower(r.name),r.id LIMIT $4 OFFSET $5`,
        [...args, input.limit, input.offset],
      )
    ).rows;
    const total = (
      await db.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${table} r ${where}`,
        args,
      )
    ).rows[0].count;
    return { items, total, limit: input.limit, offset: input.offset };
  });
  for (const method of ["POST", "PUT"] as const)
    app.route({
      method,
      url:
        method === "POST"
          ? "/api/campus/:collection"
          : "/api/campus/:collection/:id",
      handler: async (request, reply) => {
        const user = requireUser(request);
        enabled();
        const { collection, id } = z
          .object({
            collection: campusCollectionSchema,
            id: z.uuid().optional(),
          })
          .parse(request.params);
        const data = campusSchemas[collection].parse(request.body) as Record<
          string,
          unknown
        >;
        const result = await db.transaction(async (tx) => {
          const table = tables[collection];
          const existing = id
            ? (
                await tx.query<CampusRecord>(
                  `SELECT * FROM ${table} WHERE id=$1`,
                  [id],
                )
              ).rows[0]
            : undefined;
          if (id && !existing)
            throw new AppError(404, "CAMPUS_NOT_FOUND", "校园记录不存在");
          if (collection === "universities") {
            if (existing) await managed(tx, existing.id, user);
            else {
              await tx.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [
                user.id,
              ]);
              if (
                (
                  await tx.query<{ count: number }>(
                    "SELECT count(*)::int AS count FROM campus_universities WHERE owner_id=$1",
                    [user.id],
                  )
                ).rows[0].count >= 20
              )
                throw new AppError(429, "CAMPUS_QUOTA", "最多维护 20 所学校");
            }
          } else {
            await managed(
              tx,
              String(existing?.university_id ?? data.university_id),
              user,
            );
            if (
              existing &&
              ["university_id", "campus_id", "building_id"].some(
                (key) =>
                  key in data &&
                  data[key] !== existing[key as keyof CampusRecord],
              )
            )
              throw new AppError(
                409,
                "CAMPUS_PARENT_IMMUTABLE",
                "已有记录不能移动到其他学校、校区或建筑",
              );
            await relation(
              tx,
              "campus_campuses",
              data.campus_id,
              String(data.university_id),
            );
            await relation(
              tx,
              "campus_buildings",
              data.building_id,
              String(data.university_id),
              data.campus_id,
            );
            if (
              !existing &&
              (
                await tx.query<{ count: number }>(
                  `SELECT count(*)::int AS count FROM ${table} WHERE university_id=$1`,
                  [data.university_id],
                )
              ).rows[0].count >= 1000
            )
              throw new AppError(429, "CAMPUS_QUOTA", "学校资料已达到当前上限");
          }
          if (
            id &&
            !(
              await tx.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [
                id,
              ])
            ).rows.length
          )
            throw new AppError(404, "CAMPUS_NOT_FOUND", "校园记录不存在");
          const columns = Object.keys(data);
          const row = existing
            ? (
                await tx.query(
                  `UPDATE ${table} SET ${columns.map((key, index) => `${key}=$${index + 2}`).join(",")} WHERE id=$1 RETURNING *`,
                  [id, ...Object.values(data)],
                )
              ).rows[0]
            : (
                await tx.query(
                  `INSERT INTO ${table}(id,${columns.join(",")}${collection === "universities" ? ",owner_id" : ""}) VALUES($1,${columns.map((_, i) => `$${i + 2}`).join(",")}${collection === "universities" ? `,$${columns.length + 2}` : ""}) RETURNING *`,
                  [
                    randomUUID(),
                    ...Object.values(data),
                    ...(collection === "universities" ? [user.id] : []),
                  ],
                )
              ).rows[0];
          await audit(
            tx,
            `campus.${existing ? "updated" : "created"}`,
            user.id,
            { collection, record: row },
          );
          return row;
        });
        return reply.code(id ? 200 : 201).send(result);
      },
    });
  app.delete("/api/campus/:collection/:id", async (request) => {
    const user = requireUser(request);
    enabled();
    const { collection, id } = z
      .object({ collection: campusCollectionSchema, id: z.uuid() })
      .parse(request.params);
    try {
      return await db.transaction(async (tx) => {
        const table = tables[collection];
        const record = (
          await tx.query<CampusRecord>(`SELECT * FROM ${table} WHERE id=$1`, [
            id,
          ])
        ).rows[0];
        if (!record)
          throw new AppError(404, "CAMPUS_NOT_FOUND", "校园记录不存在");
        await managed(
          tx,
          collection === "universities" ? id : record.university_id!,
          user,
        );
        await tx.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
        await audit(tx, "campus.deleted", user.id, { collection, id });
        return { deleted: true };
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23503")
        throw new AppError(
          409,
          "CAMPUS_IN_USE",
          "仍有下级资料、学生关系或活动引用，不能删除",
        );
      throw error;
    }
  });
  app.get("/api/campus/me/affiliations", async (request) => {
    const user = requireUser(request);
    enabled();
    return {
      items: (
        await db.query(
          "SELECT a.*,u.name AS university_name,c.name AS campus_name FROM campus_affiliations a JOIN campus_universities u ON u.id=a.university_id LEFT JOIN campus_campuses c ON c.id=a.campus_id WHERE a.user_id=$1 ORDER BY u.name",
          [user.id],
        )
      ).rows,
    };
  });
  app.put("/api/campus/me/affiliations", async (request) => {
    const user = requireUser(request);
    enabled();
    const data = affiliationSchema.parse(request.body);
    return db.transaction(async (tx) => {
      await tx.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [
        user.id,
      ]);
      const school = (
        await tx.query<CampusRecord>(
          "SELECT * FROM campus_universities WHERE id=$1 FOR SHARE",
          [data.university_id],
        )
      ).rows[0];
      if (!school)
        throw new AppError(404, "UNIVERSITY_NOT_FOUND", "学校不存在");
      if (!school.allow_affiliations)
        throw new AppError(
          409,
          "AFFILIATION_CLOSED",
          "该学校暂不接受自填学生关系",
        );
      await relation(tx, "campus_campuses", data.campus_id, data.university_id);
      if (
        (
          await tx.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM campus_affiliations WHERE user_id=$1 AND university_id<>$2",
            [user.id, data.university_id],
          )
        ).rows[0].count >= 20
      )
        throw new AppError(429, "CAMPUS_QUOTA", "最多关联 20 所学校");
      const row = (
        await tx.query(
          "INSERT INTO campus_affiliations(user_id,university_id,campus_id,program) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,university_id) DO UPDATE SET campus_id=EXCLUDED.campus_id,program=EXCLUDED.program RETURNING *",
          [user.id, data.university_id, data.campus_id, data.program],
        )
      ).rows[0];
      await audit(tx, "campus.affiliation.updated", user.id, {
        universityId: data.university_id,
      });
      return row;
    });
  });
  app.delete("/api/campus/me/affiliations/:id", async (request) => {
    const user = requireUser(request);
    enabled();
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    return db.transaction(async (tx) => {
      await tx.query(
        "DELETE FROM campus_affiliations WHERE user_id=$1 AND university_id=$2",
        [user.id, id],
      );
      await audit(tx, "campus.affiliation.deleted", user.id, {
        universityId: id,
      });
      return { deleted: true };
    });
  });
  app.get("/api/campus/events/:id/location", async (request) => {
    requireUser(request);
    enabled();
    if (!modules.includes("events"))
      throw new AppError(
        409,
        "MODULE_NOT_INSTALLED",
        "Module not installed: events",
      );
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    return {
      location:
        (
          await db.query(
            "SELECT l.*,u.name AS university_name,v.name AS venue_name,v.capacity,v.latitude,v.longitude,c.name AS club_name FROM campus_event_links l JOIN campus_universities u ON u.id=l.university_id LEFT JOIN campus_venues v ON v.id=l.venue_id LEFT JOIN campus_clubs c ON c.id=l.club_id WHERE l.event_id=$1",
            [id],
          )
        ).rows[0] ?? null,
    };
  });
  app.put("/api/campus/events/:id/location", async (request) => {
    const user = requireUser(request);
    enabled();
    if (!modules.includes("events"))
      throw new AppError(
        409,
        "MODULE_NOT_INSTALLED",
        "Module not installed: events",
      );
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const data =
      request.body === null ? null : eventLocationSchema.parse(request.body);
    return db.transaction(async (tx) => {
      const event = (
        await tx.query<{ owner_id: string }>(
          "SELECT owner_id FROM entities WHERE id=$1 AND kind='event' FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "活动不存在");
      if (event.owner_id !== user.id)
        throw new AppError(403, "OWNER_REQUIRED", "只有创建者可以修改");
      if (data) {
        if (
          !(
            await tx.query("SELECT id FROM campus_universities WHERE id=$1", [
              data.university_id,
            ])
          ).rows.length
        )
          throw new AppError(404, "UNIVERSITY_NOT_FOUND", "学校不存在");
        await relation(tx, "campus_venues", data.venue_id, data.university_id);
        await relation(tx, "campus_clubs", data.club_id, data.university_id);
        await tx.query(
          "INSERT INTO campus_event_links(event_id,university_id,venue_id,club_id) VALUES($1,$2,$3,$4) ON CONFLICT(event_id) DO UPDATE SET university_id=EXCLUDED.university_id,venue_id=EXCLUDED.venue_id,club_id=EXCLUDED.club_id",
          [id, data.university_id, data.venue_id, data.club_id],
        );
      } else
        await tx.query("DELETE FROM campus_event_links WHERE event_id=$1", [
          id,
        ]);
      await audit(tx, "campus.event.linked", user.id, {
        eventId: id,
        location: data,
      });
      return { location: data };
    });
  });
}
