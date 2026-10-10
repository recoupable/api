import { z } from "zod";

/** Scoped lineage read: newest revisions first, bounded, with an exclusive revision cursor. */
export const documentHistoryOperationSchemas = [
  z.strictObject({
    action: z.literal("read_document_history"),
    document_id: z.uuid(),
    organization_id: z.uuid().optional(),
    before_revision: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
] as const;
export type DocumentHistoryOperation = z.infer<(typeof documentHistoryOperationSchemas)[number]>;
