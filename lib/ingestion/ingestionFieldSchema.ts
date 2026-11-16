import { z } from "zod";
export const ingestionFieldTypeSchema = z.enum(["string", "decimal", "integer", "date", "boolean"]);
export const ingestionColumnNameSchema = z.string().regex(/^[a-z][a-z0-9_]{0,62}$/);
export const ingestionDecimalSchema = z
  .string()
  .max(100)
  .regex(/^[+-]?\d+(?:\.\d+)?$/);
export const ingestionFieldSchema = z
  .strictObject({
    name: ingestionColumnNameSchema,
    source: z.string().min(1).max(200).optional(),
    constant: z.string().max(2000).optional(),
    type: ingestionFieldTypeSchema,
    nullable: z.boolean().default(false),
    trim: z.boolean().default(false),
    decimal_separator: z.enum([".", ","]).default("."),
    thousands_separator: z.enum(["", ",", ".", " "]).default(""),
  })
  .refine(f => (f.source !== undefined) !== (f.constant !== undefined), "Choose source or constant")
  .refine(f => f.decimal_separator !== f.thousands_separator, "Separators must differ");
