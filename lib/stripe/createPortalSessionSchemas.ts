import { z } from "zod";

export const createPortalSessionBodySchema = z
  .object({
    returnUrl: z.string().min(1, "returnUrl is required").url("returnUrl must be a valid URL"),
  })
  .strict();
