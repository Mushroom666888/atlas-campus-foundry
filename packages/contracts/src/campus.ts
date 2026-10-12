import { z } from "zod";

const name = z.string().trim().min(1).max(160);
const university_id = z.uuid();
const campus_id = z.uuid();
export const campusSchemas = {
  universities: z
    .object({ name, allow_affiliations: z.boolean().default(true) })
    .strict(),
  campuses: z
    .object({
      name,
      university_id,
      timezone: z
        .string()
        .max(80)
        .refine((v) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: v });
            return true;
          } catch {
            return false;
          }
        })
        .default("Asia/Shanghai"),
    })
    .strict(),
  buildings: z.object({ name, university_id, campus_id }).strict(),
  venues: z
    .object({
      name,
      university_id,
      campus_id,
      building_id: z.uuid().nullable().default(null),
      capacity: z.number().int().min(1).max(100000),
      latitude: z.number().min(-90).max(90).nullable().default(null),
      longitude: z.number().min(-180).max(180).nullable().default(null),
    })
    .strict()
    .refine(
      (v) => (v.latitude === null) === (v.longitude === null),
      "Latitude and longitude must be supplied together",
    ),
  courses: z
    .object({
      name,
      university_id,
      campus_id: campus_id.nullable().default(null),
      code: z.string().trim().min(1).max(40),
    })
    .strict(),
  clubs: z
    .object({
      name,
      university_id,
      campus_id: campus_id.nullable().default(null),
      description: z.string().max(2000).default(""),
    })
    .strict(),
};
export const campusCollectionSchema = z.enum([
  "universities",
  "campuses",
  "buildings",
  "venues",
  "courses",
  "clubs",
]);
export type CampusCollection = z.infer<typeof campusCollectionSchema>;
export type CampusRecord = {
  id: string;
  name: string;
  owner_id?: string;
  university_name?: string;
  university_id?: string;
  campus_id?: string | null;
  building_id?: string | null;
  capacity?: number;
  latitude?: number | null;
  longitude?: number | null;
  code?: string;
  description?: string;
  timezone?: string;
  allow_affiliations?: boolean;
};
export const affiliationSchema = z
  .object({
    university_id,
    campus_id: campus_id.nullable().default(null),
    program: z.string().max(160).default(""),
  })
  .strict();
export const eventLocationSchema = z
  .object({
    university_id,
    venue_id: z.uuid().nullable().default(null),
    club_id: z.uuid().nullable().default(null),
  })
  .strict();
