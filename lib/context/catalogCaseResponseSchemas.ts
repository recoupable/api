import { z } from "zod";
import { catalogCaseReadSnapshotSchema } from "./catalogCaseSnapshotSchema";

export const catalogCaseReceiptSchema = z.strictObject({
  case_id: z.uuid(),
  revision: z.number().int().min(1),
  state: z.enum(["saved", "partial"]),
  evidence_kind: z.literal("customer_assertion"),
  snapshot: catalogCaseReadSnapshotSchema,
  withheld_record_ids: z.array(z.string().min(1)).max(6000),
  snapshot_usable_for_save: z.boolean(),
  external_actions: z.literal("unsupported"),
  created_at: z.iso.datetime({ offset: true }),
});
export const catalogCasePageSchema = z
  .strictObject({
    cases: z
      .array(
        z.strictObject({
          case_id: z.uuid(),
          revision: z.number().int().min(1),
          created_at: z.iso.datetime({ offset: true }),
          updated_at: z.iso.datetime({ offset: true }),
        }),
      )
      .max(100),
    has_more: z.boolean(),
    next_id: z.uuid().nullable(),
  })
  .superRefine((page, ctx) => {
    if (
      page.has_more !== (page.next_id !== null) ||
      new Set(page.cases.map(item => item.case_id)).size !== page.cases.length
    )
      ctx.addIssue({ code: "custom", message: "Invalid catalog case page" });
  });
