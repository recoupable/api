import { z } from "zod";

export const companyBaselineOperationSchema = z.strictObject({
  action: z.literal("read_company_baseline"),
  organization_id: z.uuid(),
  after_artist_id: z
    .uuid()
    .optional()
    .describe("Artist relationship cursor, not artist account ID"),
  after_professional_id: z.uuid().optional(),
  after_source_id: z.uuid().optional(),
});

const page = <T extends z.ZodType>(item: T) =>
  z.strictObject({ items: z.array(item).max(50), next_id: z.uuid().nullable() });

export const companyBaselineSchema = z.strictObject({
  contract_version: z.literal("company-baseline-v1"),
  organization_id: z.uuid(),
  organization_name: z.string().nullable(),
  read_at: z.iso.datetime({ offset: true }),
  consistency: z.literal("live_read"),
  coverage: z.literal("registered_roster_and_context_sources_only"),
  artists: page(
    z.strictObject({ relationship_id: z.uuid(), artist_id: z.uuid(), name: z.string().nullable() }),
  ),
  professionals: page(
    z.strictObject({
      professional_id: z.uuid(),
      name: z.string(),
      roles: z
        .array(z.enum(["songwriter", "producer"]))
        .min(1)
        .max(2),
      confirmation_basis: z.literal("operator_confirmed"),
    }),
  ),
  sources: page(
    z.strictObject({
      source_id: z.uuid(),
      kind: z.enum([
        "provider_metadata",
        "audio",
        "lyrics",
        "artwork",
        "web",
        "social",
        "customer",
      ]),
      created_at: z.iso.datetime({ offset: true }),
      retained_version_count: z.number().int().nonnegative(),
    }),
  ),
  gaps: z.tuple([
    z.literal("company_relationships_not_linked"),
    z.literal("catalog_coverage_not_assessed"),
    z.literal("sources_not_attributed_to_roster"),
    z.literal("source_parsing_and_review_not_assessed"),
    z.literal("rights_and_mandates_not_assessed"),
  ]),
});
