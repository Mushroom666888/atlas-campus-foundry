import type { FastifyInstance } from "fastify";
import type { Database } from "../../../server/db.js";
import type { RuntimeConfig } from "../../modules/src/runtime.js";
import type { requireUser } from "../../../server/auth.js";
export interface FeatureContext {
  db: Database;
  config: RuntimeConfig;
  requireUser: typeof requireUser;
  env: Record<string, string>;
}
export type RegisterFeature = (
  app: FastifyInstance,
  context: FeatureContext,
) => Promise<void>;
