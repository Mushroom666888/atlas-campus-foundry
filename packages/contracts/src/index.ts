import { z } from "zod";

export const identifier = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
export const moduleFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]{0,40}$/),
  label: z.string(),
  type: z.enum([
    "text",
    "textarea",
    "number",
    "date",
    "url",
    "select",
    "boolean",
  ]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export const recordDefinitionSchema = z.object({
  fields: z.array(moduleFieldSchema).min(1),
  statuses: z.array(z.string()).min(2),
  visibility: z.enum(["application", "owner"]),
  view: z.enum(["cards", "table", "board"]),
  titleLabel: z.string(),
});
export type ModuleField = z.infer<typeof moduleFieldSchema>;
export type RecordDefinition = z.infer<typeof recordDefinitionSchema>;
export const moduleManifestSchema = z.object({
  moduleId: identifier,
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(2000),
  category: z.enum([
    "foundation",
    "commerce",
    "community",
    "campus",
    "scenario",
    "extension",
    "connector",
    "presentation",
  ]),
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
  tags: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  icon: z.string().default("Boxes"),
  recordDefinition: recordDefinitionSchema.optional(),
  configurationFields: z.array(moduleFieldSchema).default([]),
});
export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
const nodeId = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const compositionSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  nodes: z
    .array(
      z.object({
        id: nodeId,
        moduleId: identifier,
        position: z.object({
          x: z.number().finite().min(-10000).max(10000),
          y: z.number().finite().min(-10000).max(10000),
        }),
        title: z.string().max(60).optional(),
        view: z.enum(["cards", "table", "board"]).optional(),
        configuration: z
          .record(
            z.string().max(60),
            z.union([z.string().max(4000), z.number().finite(), z.boolean()]),
          )
          .default({}),
      }),
    )
    .min(1)
    .max(80),
  edges: z
    .array(
      z.object({
        id: nodeId,
        source: nodeId,
        target: nodeId,
        mode: z.enum([
          "navigate",
          "embed",
          "notify",
          "flow",
          "display",
          "dependency",
        ]),
      }),
    )
    .max(160),
});
export type Composition = z.infer<typeof compositionSchema>;
export const productSpecSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(5).max(4000),
  kind: z.enum(["events", "marketplace", "study", "custom"]),
  modules: z.array(identifier).min(1).max(80),
  features: z.array(z.string().min(1).max(400)).max(30),
  primaryColor: z.enum(["green", "blue", "rose"]).default("green"),
  composition: compositionSchema.optional(),
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
