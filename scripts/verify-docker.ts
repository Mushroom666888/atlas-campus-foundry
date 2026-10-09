import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { IsolatedExecutor, dockerAvailable } from "../server/executor.js";
const root = path.resolve(".data", "docker-acceptance");
await mkdir(path.join(root, "src"), { recursive: true });
if (!(await dockerAvailable())) {
  console.error(
    "BLOCKED: Docker Engine unavailable. No generated code executed on host.",
  );
  process.exitCode = 2;
} else {
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  await writeFile(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2023",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "dist",
        strict: true,
        skipLibCheck: true,
        typeRoots: ["/opt/foundry/node_modules/@types"],
      },
      include: ["src/**/*.ts"],
    }),
  );
  await writeFile(
    path.join(root, "src", "feature.ts"),
    'export function capacity(occupied:number,limit:number){ return occupied >= limit ? "waiting" : "joined"; }\n',
  );
  await writeFile(
    path.join(root, "src", "feature.test.ts"),
    'import {test} from "node:test"; import assert from "node:assert/strict"; import {existsSync} from "node:fs"; import {capacity} from "./feature.js"; test("isolated custom TypeScript",()=>{assert.equal(capacity(2,2),"waiting");assert.equal(capacity(1,2),"joined");assert.equal(process.env.LLM_API_KEY,undefined);assert.equal(existsSync("/opt/foundry/.env"),false);});\n',
  );
  const executor = new IsolatedExecutor();
  const build = await executor.run(root, "build");
  const test = build.ok ? await executor.run(root, "test") : null;
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/docker-results.json",
    JSON.stringify({ build, test }, null, 2),
  );
  console.log(JSON.stringify({ build, test }, null, 2));
  process.exitCode = build.ok && test?.ok ? 0 : 1;
}
