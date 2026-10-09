import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function lockStorage(directory: string, wait = false) {
  const canonical = await realpath(directory);
  const key = createHash("sha256")
    .update(process.platform === "win32" ? canonical.toLowerCase() : canonical)
    .digest("hex");
  // Kernel-owned endpoints cannot be stolen from a suspended process by a stale timer.
  const endpoint =
    process.platform === "win32"
      ? `\\\\.\\pipe\\campus-foundry-storage-${key}`
      : process.platform === "linux"
        ? `\0campus-foundry-storage-${key}`
        : null;
  if (!endpoint)
    throw new Error(
      "Storage locking requires Windows named pipes or Linux abstract sockets",
    );
  for (let attempt = 0; ; attempt++) {
    const server = createServer((socket) => socket.destroy());
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(endpoint, () => {
          server.removeListener("error", reject);
          server.unref();
          resolve();
        });
      });
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
      if (wait && attempt < 20) {
        await delay(100);
        continue;
      }
      throw Object.assign(
        new Error(
          "Storage is open in another process; stop it before continuing",
        ),
        { code: "ELOCKED" },
      );
    }
  }
}
