import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AppError,
  type ModuleManifest,
  type ProductSpec,
} from "../../contracts/src/index.js";
import type { Database, SQL } from "../../../server/db.js";
import { requireUser } from "../../../server/auth.js";
import { catalog } from "./catalog.js";
import { connectedModules } from "./composition.js";

export type ModuleRecord = {
  id: string;
  module_id: string;
  owner_id: string;
  title: string;
  data: Record<string, string | number | boolean>;
  status: string;
  context_id: string | null;
  created_at: string;
  updated_at: string;
};
export function recordData(module: ModuleManifest, data: unknown) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of module.recordDefinition!.fields) {
    let rule: z.ZodType;
    if (field.type === "number")
      rule = z
        .number()
        .finite()
        .min(field.min ?? 0)
        .max(field.max ?? 1000000);
    else if (field.type === "boolean") rule = z.boolean();
    else if (field.type === "select") rule = z.enum(field.options!);
    else if (field.type === "date")
      rule = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine(
          (s) =>
            !Number.isNaN(Date.parse(s)) &&
            new Date(s).toISOString().slice(0, 10) === s,
          "日期无效",
        );
    else if (field.type === "url")
      rule = z
        .string()
        .max(2000)
        .refine(
          (s) => s === "" || (/^https?:\/\//.test(s) && URL.canParse(s)),
          "仅允许 HTTP(S) 链接",
        );
    else
      rule = z
        .string()
        .max(field.type === "textarea" ? 10000 : 300)
        .min(field.required ? 1 : 0);
    shape[field.key] = field.required ? rule : rule.optional();
  }
  return z.object(shape).strict().parse(data) as ModuleRecord["data"];
}
const inputSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    data: z.record(z.string(), z.unknown()),
    status: z.string().max(80).optional(),
    contextId: z.uuid().optional(),
  })
  .strict();
const value = (record: ModuleRecord, key: string): unknown =>
  key === "title"
    ? record.title
    : key === "status"
      ? record.status
      : key === "text"
        ? Object.values(record.data).join(" ")
        : record.data[key.replace(/^data\./, "")];
const template = (text: string, record: ModuleRecord) =>
  text
    .replace(/\{([a-zA-Z][a-zA-Z0-9_.]*)\}/g, (_, key: string) =>
      String(value(record, key) ?? ""),
    )
    .slice(0, 4000);

async function runFlow(
  tx: SQL,
  spec: ProductSpec,
  record: ModuleRecord,
  actor: string,
  event: "created" | "updated" | "archived",
) {
  const graph = spec.composition;
  if (!graph) return;
  if (event === "created")
    for (const _target of connectedModules(graph, record.module_id, "notify")) {
      await tx.query(
        "INSERT INTO notifications(id,user_id,body) VALUES($1,$2,$3)",
        [randomUUID(), actor, `${record.title}已创建`],
      );
    }
  const source = graph.nodes.find((n) => n.moduleId === record.module_id);
  if (!source) return;
  const queue = graph.edges
    .filter((e) => e.mode === "flow" && e.source === source.id)
    .map((e) => ({
      id: e.target,
      record: structuredClone(record),
      message: `${record.title} · ${event}`,
    }));
  let budget = 0;
  const visited = new Set<string>();
  while (queue.length) {
    if (++budget > 160)
      throw new AppError(422, "FLOW_BUDGET", "自动化执行超出预算");
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    const node = graph.nodes.find((n) => n.id === current.id)!;
    const c = node.configuration,
      r = current.record;
    if (node.moduleId.startsWith("when-") && node.moduleId !== `when-${event}`)
      continue;
    if (node.moduleId === "status-condition" && r.status !== c.value) continue;
    if (
      node.moduleId === "keyword-condition" &&
      !String(value(r, String(c.field)) ?? "").includes(String(c.value))
    )
      continue;
    if (node.moduleId === "number-condition") {
      const actual = value(r, String(c.field));
      if (
        typeof actual !== "number" ||
        !(c.operator === ">="
          ? actual >= Number(c.value)
          : c.operator === "<="
            ? actual <= Number(c.value)
            : actual === Number(c.value))
      )
        continue;
    }
    if (
      node.moduleId === "unique-record" &&
      (
        await tx.query(
          "SELECT id FROM module_records WHERE module_id=$1 AND owner_id=$2 AND title=$3 AND id<>$4 AND archived_at IS NULL LIMIT 1",
          [record.module_id, actor, r.title, r.id],
        )
      ).rows.length
    )
      continue;
    if (node.moduleId === "field-map") {
      const key = String(c.to);
      if (
        !/^[a-z][a-zA-Z0-9]{0,40}$/.test(key) ||
        ["__proto__", "constructor", "prototype"].includes(key)
      )
        throw new AppError(422, "INVALID_MAPPING", "字段映射目标无效");
      const mapped = value(r, String(c.from));
      if (mapped !== undefined)
        r.data = { ...r.data, [key]: mapped as string | number | boolean };
    }
    if (node.moduleId === "text-template")
      current.message = template(String(c.template), r);
    if (node.moduleId === "notify-author")
      await tx.query(
        "INSERT INTO notifications(id,user_id,body) VALUES($1,$2,$3)",
        [randomUUID(), actor, current.message],
      );
    if (node.moduleId === "audit-entry")
      await tx.query("INSERT INTO domain_events(type,payload) VALUES($1,$2)", [
        "composition.activity",
        JSON.stringify({ actor, recordId: record.id, nodeId: node.id, event }),
      ]);
    if (node.moduleId === "create-linked-record") {
      const target = catalog.find((m) => m.moduleId === c.targetModule)!;
      if (!target?.recordDefinition || !spec.modules.includes(target.moduleId))
        throw new AppError(409, "MODULE_NOT_INSTALLED", "自动化目标模块未安装");
      if (
        catalog.find((m) => m.moduleId === record.module_id)?.recordDefinition
          ?.visibility === "owner" &&
        target.recordDefinition.visibility === "application"
      )
        throw new AppError(422, "PRIVATE_SOURCE", "私有记录不能复制到共享模块");
      const fields: Record<string, unknown> = {};
      for (const field of target.recordDefinition!.fields) {
        const configured = c[`data.${field.key}`];
        if (configured === undefined || (configured === "" && !field.required))
          continue;
        const rendered =
          typeof configured === "string" ? template(configured, r) : configured;
        fields[field.key] =
          field.type === "number" ? Number(rendered) : rendered;
      }
      const data = recordData(target, fields),
        title = z
          .string()
          .min(1)
          .max(160)
          .parse(template(String(c.title), r));
      const count = (
        await tx.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM module_records WHERE module_id=$1 AND owner_id=$2",
          [target.moduleId, actor],
        )
      ).rows[0].count;
      if (count >= 1000)
        throw new AppError(429, "RECORD_QUOTA", "业务记录配额已满");
      await tx.query(
        "INSERT INTO module_records(id,module_id,owner_id,title,data,status,context_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          randomUUID(),
          target.moduleId,
          actor,
          title,
          JSON.stringify(data),
          target.recordDefinition!.statuses[0],
          record.id,
        ],
      );
    }
    for (const edge of graph.edges.filter(
      (e) => e.mode === "flow" && e.source === node.id,
    ))
      queue.push({
        id: edge.target,
        record: structuredClone(r),
        message: current.message,
      });
  }
}

export async function registerRecords(
  app: FastifyInstance,
  db: Database,
  spec: ProductSpec,
) {
  const moduleFor = (id: string) => {
    const module = catalog.find((m) => m.moduleId === id && m.recordDefinition);
    if (!module || !spec.modules.includes(id))
      throw new AppError(404, "MODULE_NOT_INSTALLED", "业务模块未安装");
    return module;
  };
  async function find(
    tx: SQL,
    module: ModuleManifest,
    id: string,
    actor: string,
  ) {
    const record = (
      await tx.query<ModuleRecord>(
        "SELECT * FROM module_records WHERE id=$1 AND module_id=$2 AND archived_at IS NULL",
        [id, module.moduleId],
      )
    ).rows[0];
    if (
      !record ||
      (module.recordDefinition!.visibility === "owner" &&
        record.owner_id !== actor)
    )
      throw new AppError(404, "RECORD_NOT_FOUND", "记录不存在");
    return record;
  }
  app.get("/api/modules/:moduleId/records", async (request) => {
    const actor = requireUser(request).id,
      module = moduleFor((request.params as { moduleId: string }).moduleId);
    const query = z
      .object({
        q: z.string().max(150).default(""),
        status: z.string().max(80).optional(),
        contextId: z.uuid().optional(),
      })
      .parse(request.query);
    const params = [
      module.moduleId,
      module.recordDefinition!.visibility === "owner" ? actor : null,
      query.q,
      query.status ?? null,
      query.contextId ?? null,
    ];
    const where =
      "module_id=$1 AND ($2::text IS NULL OR owner_id=$2) AND ($3='' OR title ILIKE '%' || $3 || '%' OR data::text ILIKE '%' || $3 || '%') AND ($4::text IS NULL OR status=$4) AND ($5::text IS NULL OR context_id=$5) AND archived_at IS NULL";
    return {
      items: (
        await db.query<ModuleRecord>(
          `SELECT * FROM module_records WHERE ${where} ORDER BY created_at DESC LIMIT 200`,
          params,
        )
      ).rows,
      counts: (
        await db.query<{ status: string; count: number }>(
          `SELECT status,count(*)::int AS count FROM module_records WHERE ${where} GROUP BY status`,
          params,
        )
      ).rows,
    };
  });
  app.get("/api/modules/:moduleId/records/:id", async (request) => {
    const p = request.params as { moduleId: string; id: string };
    return find(db, moduleFor(p.moduleId), p.id, requireUser(request).id);
  });
  app.post("/api/modules/:moduleId/records", async (request, reply) => {
    const actor = requireUser(request).id,
      module = moduleFor((request.params as { moduleId: string }).moduleId),
      input = inputSchema.parse(request.body);
    const data = recordData(module, input.data),
      status = input.status ?? module.recordDefinition!.statuses[0];
    if (!module.recordDefinition!.statuses.includes(status))
      throw new AppError(400, "INVALID_STATUS", "状态无效");
    const id = randomUUID();
    await db.transaction(async (tx) => {
      // One actor lock serializes quotas and graph actions within this application's database.
      await tx.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [actor]);
      const count = (
        await tx.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM module_records WHERE module_id=$1 AND owner_id=$2",
          [module.moduleId, actor],
        )
      ).rows[0].count;
      if (count >= 1000)
        throw new AppError(429, "RECORD_QUOTA", "每个模块最多 1000 条个人记录");
      if (input.contextId) {
        const parent = (
          await tx.query<ModuleRecord>(
            "SELECT * FROM module_records WHERE id=$1 AND archived_at IS NULL",
            [input.contextId],
          )
        ).rows[0];
        if (!parent)
          throw new AppError(404, "PARENT_NOT_FOUND", "父记录不存在");
        const parentModule = moduleFor(parent.module_id);
        if (
          parentModule.recordDefinition!.visibility === "owner" &&
          module.recordDefinition!.visibility === "application"
        )
          throw new AppError(422, "PRIVATE_SOURCE", "私有记录不能嵌入共享模块");
        await find(tx, parentModule, parent.id, actor);
        if (
          !connectedModules(spec.composition, parent.module_id, "embed").some(
            (n) => n.moduleId === module.moduleId,
          )
        )
          throw new AppError(
            422,
            "NO_EMBED_CONTRACT",
            "画布没有声明此内嵌关系",
          );
      }
      await tx.query(
        "INSERT INTO module_records(id,module_id,owner_id,title,data,status,context_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          module.moduleId,
          actor,
          input.title,
          JSON.stringify(data),
          status,
          input.contextId ?? null,
        ],
      );
      await runFlow(
        tx,
        spec,
        await find(tx, module, id, actor),
        actor,
        "created",
      );
    });
    return reply.code(201).send(await find(db, module, id, actor));
  });
  app.patch("/api/modules/:moduleId/records/:id", async (request) => {
    const p = request.params as { moduleId: string; id: string },
      actor = requireUser(request).id,
      module = moduleFor(p.moduleId);
    const patch = inputSchema
      .omit({ contextId: true })
      .partial()
      .extend({ archived: z.boolean().optional() })
      .strict()
      .parse(request.body);
    let updated: ModuleRecord | undefined;
    await db.transaction(async (tx) => {
      await tx.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [actor]);
      const current = await find(tx, module, p.id, actor);
      if (current.owner_id !== actor)
        throw new AppError(403, "OWNER_REQUIRED", "只有创建者可以修改");
      const data = patch.data ? recordData(module, patch.data) : current.data,
        status = patch.status ?? current.status;
      if (!module.recordDefinition!.statuses.includes(status))
        throw new AppError(400, "INVALID_STATUS", "状态无效");
      updated = {
        ...current,
        data,
        title: patch.title ?? current.title,
        status,
      };
      await tx.query(
        "UPDATE module_records SET title=$2,data=$3,status=$4,archived_at=CASE WHEN $5 THEN now() ELSE NULL END,updated_at=now() WHERE id=$1",
        [
          p.id,
          updated.title,
          JSON.stringify(data),
          status,
          patch.archived ?? false,
        ],
      );
      await runFlow(
        tx,
        spec,
        updated,
        actor,
        patch.archived ? "archived" : "updated",
      );
    });
    return updated;
  });
}
