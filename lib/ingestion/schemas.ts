import { z } from "zod";

const name = z.string().regex(/^[a-z][a-z0-9_]{0,62}$/);
const decimal = z
  .string()
  .max(100)
  .regex(/^[+-]?\d+(?:\.\d+)?$/);
const field = z
  .strictObject({
    name,
    source: z.string().min(1).max(200).optional(),
    constant: z.string().max(2000).optional(),
    type: z.enum(["string", "decimal", "integer", "date", "boolean"]),
    nullable: z.boolean().default(false),
    trim: z.boolean().default(false),
    decimal_separator: z.enum([".", ","]).default("."),
    thousands_separator: z.enum(["", ",", ".", " "]).default(""),
  })
  .refine(f => (f.source !== undefined) !== (f.constant !== undefined), "Choose source or constant")
  .refine(f => f.decimal_separator !== f.thousands_separator, "Separators must differ");

export const ingestionContractSchema = z
  .strictObject({
    version: z.string().min(1).max(100),
    fields: z.array(field).min(1).max(100),
    business_keys: z.array(name).max(20).default([]),
    sheet: z.string().min(1).max(200).optional(),
    header_row: z.number().int().min(1).max(1000).default(1),
    records_path: z.array(z.string().min(1).max(100)).max(10).default([]),
    delimiter: z.enum([",", ";", "\t", "|"]).default(","),
    ignored_columns: z.array(z.string().min(1).max(200)).max(100).default([]),
    controls: z
      .array(
        z.strictObject({
          field: name,
          expected: decimal,
          tolerance: decimal.default("0"),
          where: z.record(name, z.string().max(2000)).default({}),
        }),
      )
      .max(100)
      .default([]),
    aggregate: z
      .strictObject({ group_by: z.array(name).max(20), sums: z.array(name).min(1).max(20) })
      .optional(),
    text_table: z
      .strictObject({
        review_ref: z.string().min(1).max(200),
        separator: z
          .string()
          .min(1)
          .max(10)
          .refine(s => !/[\r\n]/.test(s), "A separator cannot contain line breaks"),
      })
      .optional(),
  })
  .superRefine((c, ctx) => {
    const names = c.fields.map(f => f.name);
    const sources = c.fields.flatMap(f => (f.source === undefined ? [] : [f.source]));
    if (new Set(names).size !== names.length || new Set(sources).size !== sources.length)
      ctx.addIssue({ code: "custom", message: "Field names and source columns must be unique" });
    if (
      c.ignored_columns.some(n => sources.includes(n)) ||
      new Set(c.ignored_columns).size !== c.ignored_columns.length
    )
      ctx.addIssue({ code: "custom", message: "Ignored columns cannot be mapped or duplicated" });
    const references = [
      ...c.business_keys,
      ...c.controls.flatMap(r => [r.field, ...Object.keys(r.where)]),
      ...(c.aggregate?.group_by ?? []),
      ...(c.aggregate?.sums ?? []),
    ];
    if (references.some(n => !names.includes(n)))
      ctx.addIssue({ code: "custom", message: "Unknown field reference" });
    const numeric = (n: string) =>
      c.fields.some(f => f.name === n && ["decimal", "integer"].includes(f.type));
    if (
      c.controls.some(r => !numeric(r.field) || r.tolerance.startsWith("-")) ||
      c.aggregate?.sums.some(n => !numeric(n))
    )
      ctx.addIssue({
        code: "custom",
        message: "Controls and sums need numeric fields and nonnegative tolerances",
      });
    const grouped = [...(c.aggregate?.group_by ?? []), ...(c.aggregate?.sums ?? [])];
    if (
      new Set(grouped).size !== grouped.length ||
      new Set(c.business_keys).size !== c.business_keys.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate key or aggregate reference" });
  });

export const ingestionFormatSchema = z.enum(["csv", "tsv", "json", "jsonl", "xlsx", "pdf"]);
const key = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);
export const ingestionOperationSchema = z.discriminatedUnion("action", [
  z
    .strictObject({
      action: z.literal("create"),
      organization_id: z.uuid().optional(),
      dataset_id: z.uuid().optional(),
      idempotency_key: key,
      source: z.discriminatedUnion("kind", [
        z.strictObject({
          kind: z.literal("inline"),
          filename: z.string().min(1).max(200),
          format: ingestionFormatSchema,
          content_base64: z
            .string()
            .min(4)
            .max(2796204)
            .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
        }),
        z.strictObject({ kind: z.literal("connector"), connector_id: key }),
      ]),
      contract: ingestionContractSchema,
    })
    .refine(v => !v.dataset_id || !!v.organization_id, "Datasets require an organization"),
  z.strictObject({
    action: z.literal("datasets"),
    organization_id: z.uuid(),
    limit: z.number().int().min(1).max(50).default(25),
    after: z.uuid().optional(),
  }),
  z.strictObject({
    action: z.literal("imports"),
    organization_id: z.uuid(),
    dataset_id: z.uuid(),
    limit: z.number().int().min(1).max(50).default(25),
    after: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  }),
  z.strictObject({
    action: z.literal("records"),
    organization_id: z.uuid(),
    dataset_id: z.uuid(),
    job_id: z.string().regex(/^[a-f0-9]{64}$/),
    limit: z.number().int().min(1).max(100).default(25),
    after_row: z.number().int().min(0).max(10000).default(0),
  }),
  z.strictObject({
    action: z.literal("read"),
    organization_id: z.uuid().optional(),
    job_id: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  z.strictObject({
    action: z.literal("artifact"),
    organization_id: z.uuid().optional(),
    job_id: z.string().regex(/^[a-f0-9]{64}$/),
    stage: z.enum(["bronze", "silver", "gold"]),
  }),
  z.strictObject({
    action: z.literal("deliver"),
    organization_id: z.uuid().optional(),
    job_id: z.string().regex(/^[a-f0-9]{64}$/),
    destination_id: key,
    gold_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
]);
