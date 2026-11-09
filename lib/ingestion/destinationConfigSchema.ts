import { z } from "zod";
const identifier = z.string().regex(/^[a-z][a-z0-9_]{0,62}$/);
export const destinationConfigSchema = z
  .strictObject({
    id: z.string().min(1).max(128),
    scope: z.string().regex(/^(account|organization)\/[a-f0-9-]{36}$/),
    connection_env: z.string().regex(/^INGESTION_DB_[A-Z0-9_]+$/),
    database_id: z.uuid().transform(s => s.toLowerCase()),
    schema: identifier,
    table: identifier,
    receipt_schema: identifier.default("ingestion"),
    receipt_table: identifier.default("delivery_receipts"),
    columns: z.array(identifier).min(1).max(100),
    mode: z.enum(["append", "upsert"]),
    business_keys: z.array(identifier).max(20).default([]),
  })
  .superRefine((c, ctx) => {
    if (
      new Set(c.columns).size !== c.columns.length ||
      new Set(c.business_keys).size !== c.business_keys.length ||
      c.business_keys.some(k => !c.columns.includes(k)) ||
      (c.mode === "upsert" && !c.business_keys.length) ||
      (c.mode === "append" && c.business_keys.length > 0) ||
      (c.schema === c.receipt_schema && c.table === c.receipt_table)
    )
      ctx.addIssue({ code: "custom", message: "Invalid destination columns or keys" });
  });
export type DestinationConfig = z.infer<typeof destinationConfigSchema>;
export const destinationConfigsSchema = z
  .array(destinationConfigSchema)
  .refine(
    configs => new Set(configs.map(c => `${c.scope}/${c.id}`)).size === configs.length,
    "Duplicate destination ID",
  );
