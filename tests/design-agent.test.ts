import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { Agent, type LlmProvider, type LlmMessage } from "../server/agent.js";
import { createControl } from "../server/control.js";
import {
  productSpecSchema,
  type ProductSpec,
} from "../packages/contracts/src/index.js";
import { catalog } from "../packages/modules/src/catalog.js";

test("design-only Agent contract provider: validated persistent plan, no project mutation or deployment", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "atlas-design-"));
  const c = await createControl({ dataDir: root });
  try {
    const registered = await c.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "designer@atlas.test", password: "Designer12345" },
    });
    const owner = registered.json().user.id;
    const id = randomUUID();
    await c.db.query(
      "INSERT INTO jobs(id,owner_id,input,mode,status) VALUES($1,$2,$3,'design','queued')",
      [id, owner, "A campus store +sales-orders"],
    );
    const plan = {
      name: "Campus shop",
      description: "Sell books with stock and buyer order tracking",
      kind: "custom",
      modules: ["sales-orders"],
      primaryColor: "green",
      features: ["Sellers publish books", "Buyers place orders"],
    };
    let count = 0;
    const provider: LlmProvider = {
      async complete(_messages, definitions) {
        assert.ok(
          !JSON.stringify(definitions).includes('"name":"createPreview"'),
        );
        const message: LlmMessage =
          count++ === 0
            ? {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "design",
                    type: "function",
                    function: {
                      name: "proposeDesign",
                      arguments: JSON.stringify({ spec: plan }),
                    },
                  },
                ],
              }
            : {
                role: "assistant",
                content: "Contract fixture: proposal ready for review",
              };
        return message;
      },
    };
    const agent = new Agent(c.projects, c.deployments, provider);
    await agent.run(id);
    assert.equal((await agent.get(id, owner)).status, "succeeded");
    const saved = (
      await c.db.query<{ plan: ProductSpec }>(
        "SELECT plan FROM jobs WHERE id=$1",
        [id],
      )
    ).rows[0].plan;
    assert.ok(saved.modules.includes("identity"));
    assert.ok(saved.composition!.edges.length >= 6);
    assert.equal((await c.db.query("SELECT * FROM projects")).rows.length, 0);
    assert.equal(
      (await c.db.query("SELECT * FROM deployments")).rows.length,
      0,
    );
    await assert.rejects(
      agent.execute(await agent.get(id, owner), "writeProjectFiles", {
        path: "src/feature.ts",
        content: "bad",
      }),
      /设计阶段/,
    );
    const created = await c.projects.create(
      owner,
      saved,
      "User-reviewed proposal",
    );
    assert.deepEqual(created.project.spec.composition, saved.composition);
    const events = await c.db.query(
      "SELECT * FROM job_events WHERE job_id=$1",
      [id],
    );
    assert.ok(events.rows.length >= 4);
    const large = (await agent.execute(
      await agent.get(id, owner),
      "proposeDesign",
      {
        spec: {
          ...plan,
          modules: catalog
            .filter((m) => m.recordDefinition)
            .map((m) => m.moduleId),
        },
      },
    )) as { spec: ProductSpec };
    assert.equal(productSpecSchema.safeParse(large.spec).success, true);
    assert.ok(large.spec.composition!.nodes.length >= 51);
    await c.projects.create(owner, large.spec, "Reviewed large proposal");
  } finally {
    await c.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
