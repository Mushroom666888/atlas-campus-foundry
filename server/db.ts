import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { lockStorage } from "./storage-lock.js";

export interface SQL {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}
export class Database implements SQL {
  private pg?: pg.Pool;
  private embedded?: PGlite;
  private release?: () => Promise<void>;
  private chain: Promise<unknown> = Promise.resolve();
  constructor(
    private location: string,
    private url?: string,
  ) {}
  async init() {
    if (this.url) this.pg = new pg.Pool({ connectionString: this.url, max: 8 });
    else {
      if (this.location !== "memory://") {
        await mkdir(this.location, { recursive: true });
        this.release = await lockStorage(this.location, true);
      }
      try {
        this.embedded = new PGlite(this.location);
        await this.embedded.waitReady;
      } catch (error) {
        await this.release?.();
        this.release = undefined;
        throw error;
      }
    }
    return this;
  }
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => {});
    return next;
  }
  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ rows: T[] }> {
    if (this.pg)
      return this.pg.query(sql, params) as unknown as Promise<{ rows: T[] }>;
    return this.exclusive(() => this.embedded!.query<T>(sql, params));
  }
  async exec(sql: string) {
    if (this.pg) return this.pg.query(sql);
    return this.exclusive(() => this.embedded!.exec(sql));
  }
  async transaction<T>(fn: (tx: SQL) => Promise<T>): Promise<T> {
    if (this.pg) {
      const client = await this.pg.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: <R>(s: string, p?: unknown[]) =>
            client.query(s, p) as unknown as Promise<{ rows: R[] }>,
          exec: (s) => client.query(s),
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    return this.exclusive(() =>
      this.embedded!.transaction((tx) =>
        fn({ query: (s, p) => tx.query(s, p), exec: (s) => tx.exec(s) }),
      ),
    );
  }
  async migrate(scope: "control" | "runtime") {
    await this.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const migrations = (await readdir(path.resolve("migrations", scope)))
      .filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name))
      .sort();
    for (const migration of migrations) {
      const version = `${scope}/${migration}`;
      if (
        (
          await this.query(
            "SELECT version FROM schema_migrations WHERE version=$1",
            [version],
          )
        ).rows.length
      )
        continue;
      const sql = await readFile(path.resolve("migrations", version), "utf8");
      await this.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query("INSERT INTO schema_migrations(version) VALUES($1)", [
          version,
        ]);
      });
    }
  }
  async close() {
    await this.chain;
    if (this.pg) await this.pg.end();
    else await this.embedded?.close();
    await this.release?.();
    this.release = undefined;
  }
}
