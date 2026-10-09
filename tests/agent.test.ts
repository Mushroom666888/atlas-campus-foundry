import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createControl } from "../server/control.js";
import { Agent, type LlmProvider, type LlmMessage } from "../server/agent.js";

class ScriptedContractProvider implements LlmProvider {
  constructor(private replies: LlmMessage[]) {}
  async complete() {
    const reply = this.replies.shift();
    if (!reply) throw new Error("Unexpected provider call");
    return reply;
  }
}
function call(name: string, args: unknown): LlmMessage {
  return {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: randomUUID(),
        type: "function",
        function: { name, arguments: JSON.stringify(args) },
      },
    ],
  };
}
test("Agent contract-only provider: real tools, durable trace, stale preview rejected, repair budget enforced", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-agent-"));
  const c = await createControl({ dataDir: root });
  try {
    const registered = await c.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "agent@test.example", password: "AgentPassword123" },
    });
    const user = registered.json().user;
    const project = await c.projects.create(
      user.id,
      {
        name: "Agent contract app",
        description: "Explicit scripted provider test, not live LLM",
        kind: "events",
        modules: ["events"],
        features: [],
        primaryColor: "green",
      },
      "Contract test",
    );
    async function queued(input: string) {
      const id = randomUUID();
      await c.db.query(
        "INSERT INTO jobs(id,project_id,owner_id,input,mode,status) VALUES($1,$2,$3,$4,'contract-test','queued')",
        [id, project.project.id, user.id, input],
      );
      return id;
    }
    const first = await queued("Check stale preview");
    const agent = new Agent(
      c.projects,
      c.deployments,
      new ScriptedContractProvider([
        call("createPreview", {}),
        call("selectModules", { moduleIds: ["events", "search"] }),
        { role: "assistant", content: "Scripted completion" },
      ]),
    );
    await agent.run(first);
    assert.equal((await agent.get(first, user.id)).status, "needs_attention");
    const events = (
      await c.db.query<{ type: string; payload: { name: string } }>(
        "SELECT type,payload FROM job_events WHERE job_id=$1 ORDER BY id",
        [first],
      )
    ).rows;
    assert.ok(
      events.some(
        (e) => e.type === "tool_result" && e.payload.name === "createPreview",
      ),
    );
    const second = await queued("Invalid tool requests must stop");
    const failing = new Agent(
      c.projects,
      c.deployments,
      new ScriptedContractProvider([
        call("execShell", { command: "whoami" }),
        call("readProjectFiles", { path: "../outside" }),
        call("writeProjectFiles", { path: ".env", content: "bad" }),
      ]),
    );
    await failing.run(second);
    assert.equal((await failing.get(second, user.id)).status, "failed");
    const stored = (
      await c.db.query<{ error: string }>(
        "SELECT error FROM jobs WHERE id=$1",
        [second],
      )
    ).rows[0];
    assert.match(stored.error, /Repair budget exhausted/);
    const third = await queued(
      "Write actual custom source without executing it",
    );
    const custom = new Agent(
      c.projects,
      c.deployments,
      new ScriptedContractProvider([
        call("generateCustomFeature", {
          files: [
            {
              path: "src/feature.ts",
              content:
                "export function ordering(position:number){ return position + 1; }",
            },
          ],
          rationale: "Contract fixture exercises actual file tool",
        }),
        { role: "assistant", content: "Source written; no execution evidence" },
      ]),
    );
    await custom.run(third);
    assert.equal((await custom.get(third, user.id)).status, "needs_attention");
    assert.match(
      await c.projects.read(project.project.id, user.id, "src/feature.ts"),
      /ordering/,
    );
  } finally {
    await c.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
