import { z } from "zod";
export const contextOriginalPreparationSchema = z
  .object({
    sourceId: z
      .string()
      .uuid()
      .transform(value => value.toLowerCase()),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/),
    mediaType: z.enum(["application/pdf", "text/csv"]),
  })
  .strict();
