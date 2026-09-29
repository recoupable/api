import { z } from "zod";
export const returnUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash;
  }, "Use an HTTPS return URL without credentials or a fragment");
export const configInputSchema = z
  .object({
    returnUrl: returnUrlSchema,
    marketingText: z.string().trim().min(20).max(1000),
    enabled: z.boolean(),
    revision: z.number().int().min(0),
  })
  .strict();
export const configSchema = z.object({
  site_id: z.string().uuid(),
  return_url: returnUrlSchema,
  marketing_text: z.string(),
  enabled: z.boolean(),
  revision: z.number().int(),
});
export const sessionSchema = z.object({
  state_hash: z.string(),
  site_id: z.string().uuid(),
  browser_hash: z.string(),
  verifier: z.string(),
  return_url: returnUrlSchema,
  marketing_text: z.string(),
  config_revision: z.number().int(),
  scopes: z.array(z.string()),
  expires_at: z.string(),
});
export const fanQuerySchema = z
  .object({
    offset: z.coerce.number().int().min(0).max(100000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type FanConfig = z.infer<typeof configSchema>;
export type FanSession = z.infer<typeof sessionSchema>;
