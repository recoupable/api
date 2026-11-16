import { z } from "zod";
import {
  ingestionColumnNameSchema as name,
  ingestionDecimalSchema as decimal,
  ingestionFieldSchema as field,
} from "./ingestionFieldSchema";
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
