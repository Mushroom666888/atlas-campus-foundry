import { z } from "zod";

export const identifier = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
export const moduleManifestSchema = z.object({
  moduleId: identifier,
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(2000),
  category: z.enum(["foundation", "campus", "scenario", "extension"]),
  capabilities: z.array(z.string()),
  configurationSchema: z.record(z.string(), z.unknown()),
  providedInterfaces: z.array(z.string()),
  requiredInterfaces: z.array(z.string()),
  dependencies: z.record(z.string(), z.string()),
  databaseMigrations: z.array(z.string()),
  requiredPermissions: z.array(z.string()),
  eventsProduced: z.array(z.string()),
  eventsConsumed: z.array(z.string()),
  frontendExports: z.array(z.string()),
  backendExports: z.array(z.string()),
  healthChecks: z.array(z.string()),
  testSpecifications: z.array(z.string()),
  compatiblePlatformVersions: z.string(),
  securityMetadata: z.object({
    review: z.enum(["platform", "pending", "approved"]),
    execution: z.enum(["declarative", "isolated-code"]),
    network: z.array(z.string()),
  }),
  license: z.string().min(1),
});
export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
export const productSpecSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(5).max(4000),
  kind: z.enum(["events", "marketplace", "study", "custom"]),
  modules: z.array(identifier).min(1).max(30),
  features: z.array(z.string().min(1).max(400)).max(30),
  primaryColor: z.enum(["green", "blue", "rose"]).default("green"),
});
export type ProductSpec = z.infer<typeof productSpecSchema>;
export const featureRecipeSchema = z.object({
  type: z.literal("capacity-waitlist"),
  version: z.literal(1),
  entity: z.enum(["event", "group"]),
  capacityField: z.literal("capacity"),
  promotion: z.literal("fifo"),
  notify: z.boolean(),
});
export type FeatureRecipe = z.infer<typeof featureRecipeSchema>;
export const credentialsSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(10).max(128),
  name: z.string().min(1).max(80).optional(),
});
export const entityKinds = [
  "event",
  "listing",
  "profile",
  "group",
  "location",
  "course",
  "post",
  "school",
] as const;
export const entitySchema = z.object({
  kind: z.enum(entityKinds),
  title: z.string().min(1).max(160),
  body: z.string().max(10000).default(""),
  data: z.record(z.string(), z.unknown()).default({}),
});
export type EntityInput = z.infer<typeof entitySchema>;
export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  verified: boolean;
};
export type Entity = {
  id: string;
  kind: string;
  owner_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
};
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
