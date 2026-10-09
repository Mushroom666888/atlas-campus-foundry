import "dotenv/config";
import path from "node:path";
import { createBackup, restoreBackup, verifyBackup } from "../server/backup.js";

const [operation, source, target] = process.argv.slice(2);
if (operation === "create") {
  if (process.env.DATABASE_URL)
    throw new Error("Use PostgreSQL pg_dump for DATABASE_URL deployments");
  const destination =
    source ||
    path.join(".backups", new Date().toISOString().replaceAll(/[:.]/g, "-"));
  console.log(
    JSON.stringify(
      await createBackup(process.env.DATA_DIR || ".data", destination),
      null,
      2,
    ),
  );
} else if (operation === "verify" && source) {
  const manifest = await verifyBackup(source);
  console.log(
    JSON.stringify({
      status: "VERIFIED",
      files: manifest.files.length,
      createdAt: manifest.createdAt,
    }),
  );
} else if (operation === "restore" && source && target) {
  console.log(JSON.stringify(await restoreBackup(source, target), null, 2));
} else
  throw new Error(
    "Usage: npm run backup -- create [new-directory] | verify <backup> | restore <backup> <new-data-directory>",
  );
