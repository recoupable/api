import { z } from "zod";

const address = z.string().min(1).max(2048).url();
const addresses = z
  .array(address)
  .min(1)
  .max(32)
  .refine(values => new Set(values).size === values.length, "Addresses must be unique");
/** Proposed addresses only: syntax validation never proves domain ownership. */
export const applicationRegistrationSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    organization_id: z.string().uuid().optional(),
    environment: z.enum(["development", "production"]),
    allowed_origins: addresses,
    return_urls: addresses,
  })
  .strict();
