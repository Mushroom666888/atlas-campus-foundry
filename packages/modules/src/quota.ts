import { AppError } from "../../contracts/src/index.js";
import type { Database, SQL } from "../../../server/db.js";
const limits = {
  creator_products: { column: "owner_id", max: 50 },
  community_posts: { column: "author_id", max: 500 },
  community_replies: { column: "author_id", max: 5000 },
  commerce_products: { column: "shop_id", max: 500 },
  commerce_services: { column: "shop_id", max: 1000 },
  commerce_coupons: { column: "shop_id", max: 500 },
} as const;
export async function withQuota<T>(
  db: Database,
  table: keyof typeof limits,
  owner: string,
  fn: (tx: SQL) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(71240,hashtext($1))", [owner]);
    const { column, max } = limits[table];
    const { count } = (
      await tx.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${table} WHERE ${column}=$1`,
        [owner],
      )
    ).rows[0];
    if (count >= max)
      throw new AppError(
        429,
        "CONTENT_QUOTA",
        `已达到当前空间的内容上限（${max} 条）`,
      );
    return fn(tx);
  });
}
