import { z } from "zod";
const nonnegative = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positive = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const schema = z
  .object({
    operation: z.enum([
      "returning_sign_in",
      "recovery",
      "disconnect",
      "new_registration",
      "campaign_operation",
    ]),
    binding: z.enum(["existing", "absent"]),
    security: z.enum(["active", "revoked", "deleted"]),
    campaign: z.enum(["funded", "exhausted"]),
    now_ms: nonnegative,
    authenticated_at_ms: nonnegative,
    policy: z
      .object({
        max_auth_age_ms: positive,
        session_lifetime_ms: positive,
        auth_admission: z.enum(["admitted", "denied"]),
        new_registration_admission: z.enum(["admitted", "denied", "unknown"]),
      })
      .strict(),
  })
  .strict();
/** Pure policy model; candidate lanes are not authentication, reservations or adopted rates. */
export function decideFanHostContinuity(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return "unavailable";
  const value = parsed.data;
  if (value.security !== "active") return "denied";
  const age = value.now_ms - value.authenticated_at_ms;
  if (
    age < 0 ||
    age > value.policy.max_auth_age_ms ||
    value.now_ms > Number.MAX_SAFE_INTEGER - value.policy.session_lifetime_ms
  )
    return "unavailable";
  if (value.operation === "new_registration") {
    if (value.binding !== "absent") return "denied";
    if (value.policy.new_registration_admission === "unknown") return "unavailable";
    return value.policy.new_registration_admission === "admitted"
      ? "registration_lane_candidate"
      : "denied";
  }
  if (value.binding !== "existing") return "denied";
  if (value.operation === "campaign_operation")
    return value.campaign === "funded" ? "campaign_lane_candidate" : "denied";
  return value.policy.auth_admission === "admitted" ? "auth_lane_candidate" : "denied";
}
