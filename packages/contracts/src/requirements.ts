import { z } from "zod";

const key = z.string().regex(/^[a-z][a-zA-Z0-9_-]{0,63}$/);
export const requirementsSchema = z
  .object({
    roles: z
      .array(
        z.object({
          id: key,
          name: z.string().min(1).max(80),
          responsibility: z.string().min(1).max(600),
        }),
      )
      .max(20),
    models: z
      .array(
        z.object({
          id: key,
          name: z.string().min(1).max(80),
          fields: z
            .array(
              z.object({
                name: key,
                type: z.enum([
                  "text",
                  "number",
                  "boolean",
                  "date",
                  "reference",
                ]),
                required: z.boolean(),
                references: key.optional(),
              }),
            )
            .min(1)
            .max(40),
        }),
      )
      .max(30),
    scenarios: z
      .array(
        z.object({
          id: key,
          title: z.string().min(1).max(160),
          roleId: key,
          given: z.string().min(1).max(1000),
          when: z.string().min(1).max(1000),
          then: z.string().min(1).max(1000),
          moduleIds: z.array(key).max(20),
        }),
      )
      .max(60),
  })
  .superRefine((value, context) => {
    function unique(values: string[], at: (string | number)[]) {
      if (new Set(values).size !== values.length)
        context.addIssue({
          code: "custom",
          path: at,
          message: "Identifiers must be unique",
        });
    }
    unique(
      value.roles.map((r) => r.id),
      ["roles"],
    );
    unique(
      value.models.map((m) => m.id),
      ["models"],
    );
    unique(
      value.scenarios.map((s) => s.id),
      ["scenarios"],
    );
    for (const [i, model] of value.models.entries()) {
      unique(
        model.fields.map((f) => f.name),
        ["models", i, "fields"],
      );
      for (const [j, field] of model.fields.entries()) {
        if (
          field.type === "reference" &&
          !value.models.some((m) => m.id === field.references)
        )
          context.addIssue({
            code: "custom",
            path: ["models", i, "fields", j, "references"],
            message: "Reference target must be an existing model",
          });
        if (field.type !== "reference" && field.references !== undefined)
          context.addIssue({
            code: "custom",
            path: ["models", i, "fields", j],
            message: "Only reference fields may declare a target",
          });
      }
    }
    for (const [i, scenario] of value.scenarios.entries())
      if (!value.roles.some((r) => r.id === scenario.roleId))
        context.addIssue({
          code: "custom",
          path: ["scenarios", i, "roleId"],
          message: "Scenario role must exist",
        });
  });
export type ProductRequirements = z.infer<typeof requirementsSchema>;

export function requirementReadiness(requirements?: ProductRequirements) {
  const warnings: string[] = [];
  if (!requirements?.roles.length) warnings.push("MISSING_ROLES");
  if (!requirements?.models.length) warnings.push("MISSING_MODELS");
  if (!requirements?.scenarios.length) warnings.push("MISSING_SCENARIOS");
  for (const role of requirements?.roles ?? [])
    if (!requirements?.scenarios.some((s) => s.roleId === role.id))
      warnings.push(`ROLE_WITHOUT_SCENARIO:${role.id}`);
  return {
    status: warnings.length ? "incomplete" : "specified",
    warnings,
    scenarios: (requirements?.scenarios ?? []).map((s) => ({
      id: s.id,
      status: "NOT_RUN" as const,
    })),
  };
}
