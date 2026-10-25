import { sameCatalogUuid } from "./sameCatalogUuid";
import { z } from "zod";
import { contextIngestSchema } from "./schema";
import { catalogCaseSnapshotSchema } from "./catalogCaseSnapshotSchema";

export const catalogCaseOperationSchemas = [
  z
    .strictObject({
      action: z.literal("save_catalog_case"),
      organization_id: z.uuid().optional(),
      case_id: z.uuid(),
      expected_revision: z.number().int().nonnegative(),
      idempotency_key: contextIngestSchema.shape.idempotency_key,
      snapshot: catalogCaseSnapshotSchema,
    })
    .superRefine((input, ctx) => {
      if (
        !sameCatalogUuid(input.snapshot.case_id, input.case_id) ||
        input.snapshot.revision !== input.expected_revision
      )
        ctx.addIssue({
          code: "custom",
          path: ["snapshot"],
          message: "Snapshot case and revision must match the save request",
        });
    }),
  z.strictObject({
    action: z.literal("read_catalog_case"),
    organization_id: z.uuid().optional(),
    case_id: z.uuid(),
    revision: z.number().int().min(1).optional(),
  }),
  z.strictObject({
    action: z.literal("list_catalog_cases"),
    organization_id: z.uuid().optional(),
    after_id: z.uuid().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
] as const;
export type CatalogCaseOperation = z.infer<(typeof catalogCaseOperationSchemas)[number]>;
