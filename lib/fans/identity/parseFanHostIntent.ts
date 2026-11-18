import { z } from "zod";
const id = z
  .string()
  .min(1)
  .max(256)
  .refine(value => !/[\u0000\uD800-\uDFFF]/u.test(value), "Invalid opaque identifier");
const revision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const common = {
  version: z.literal(1),
  operation_id: id,
  customer_id: id,
  application_id: id,
  environment: z.enum(["development", "production"]),
  intended_recipient: id,
  return_url: z
    .string()
    .min(1)
    .max(2048)
    .refine(value => {
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !value.includes("#") &&
          url.href === value
        );
      } catch {
        return false;
      }
    }, "Use an exact canonical HTTPS return target"),
  initiation_id: id,
  expected_application_revision: revision,
  expected_identity_revision: revision,
  fan_id: id,
};
const schema = z.discriminatedUnion("purpose", [
  z.object({ ...common, purpose: z.literal("host_sign_in") }).strict(),
  z
    .object({
      ...common,
      purpose: z.literal("link_existing_host"),
      host_account_id: id,
      host_session_reference: id,
      host_session_generation: revision,
      expected_mapping_revision: revision.max(Number.MAX_SAFE_INTEGER - 1),
    })
    .strict(),
]);
/** Inactive domain shape parser. Parsed JSON has no identity or authorization provenance. */
export function parseFanHostIntent(input: unknown) {
  return schema.parse(input);
}
