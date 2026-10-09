import "dotenv/config";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
async function available(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}
let port = Number(process.env.PORT || 3000);
for (let count = 0; count < 30 && !(await available(port)); count++) port++;
const root = path.resolve(process.env.DATA_DIR || ".data");
await mkdir(root, { recursive: true });
const child = spawn(process.execPath, ["--import", "tsx", "server/main.ts"], {
  env: {
    ...process.env,
    PORT: String(port),
    PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN?.startsWith("https://")
      ? process.env.PUBLIC_ORIGIN
      : `http://127.0.0.1:${port}`,
  },
  stdio: ["inherit", "inherit", "inherit", "ipc"],
  windowsHide: true,
  shell: false,
});
child.on("message", (message) => {
  if ((message as { type?: string }).type !== "ready") return;
  void writeFile(
    path.join(root, "local-running.json"),
    JSON.stringify(
      {
        url: `http://127.0.0.1:${port}`,
        port,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  ).then(() => {
    console.log(`Campus AI App Foundry: http://127.0.0.1:${port}`);
  });
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    if (child.connected) child.disconnect();
    else child.kill(signal);
  });
