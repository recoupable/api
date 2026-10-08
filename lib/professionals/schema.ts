import { z } from "zod";

export const listProfessionalsSchema = z
  .object({
    organization_id: z.uuid(),
    after: z.uuid().optional(),
  })
  .strict();

export const confirmProfessionalSchema = z
  .object({
    organization_id: z.uuid(),
    idempotency_key: z.uuid(),
    mode: z.enum(["new", "existing"]),
    name: z
      .string()
      .trim()
      .min(2)
      .max(200)
      .regex(/^[^\x00-\x1f\x7f]+$/)
      .optional(),
    professional_id: z.uuid().optional(),
    roles: z
      .array(z.enum(["songwriter", "producer"]))
      .min(1)
      .max(2)
      .refine(roles => new Set(roles).size === roles.length, "Choose distinct roles"),
    roster_intent: z.literal("add"),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "new" && (!value.name || value.professional_id))
      ctx.addIssue({
        code: "custom",
        message: "Confirm a new professional name without an existing ID",
      });
    if (value.mode === "existing" && (!value.professional_id || value.name))
      ctx.addIssue({
        code: "custom",
        message: "Select an existing professional ID without renaming it",
      });
  });

export const professionalSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  name: z.string(),
  roles: z.array(z.enum(["songwriter", "producer"])),
  confirmed_by: z.uuid(),
  confirmation_basis: z.literal("operator_confirmed"),
  created_at: z.string(),
  updated_at: z.string(),
});
export const professionalListSchema = z.object({
  professionals: z.array(professionalSchema),
  next_cursor: z.uuid().nullable(),
});
export const professionalResultSchema = z.object({
  professional: professionalSchema,
  created: z.boolean(),
});
export type ConfirmProfessionalInput = z.infer<typeof confirmProfessionalSchema>;
export type ListProfessionalsInput = z.infer<typeof listProfessionalsSchema>;
