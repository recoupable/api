import { z } from "zod";
import { parseFanHostIntent } from "./parseFanHostIntent";
const observations = z
  .object({
    intent: z.unknown(),
    host_account_id: z.string(),
    scope: z
      .object({
        customer_id: z.string(),
        application_id: z.string(),
        environment: z.enum(["development", "production"]),
      })
      .strict(),
    host_mapping: z.discriminatedUnion("state", [
      z.object({ state: z.literal("absent") }).strict(),
      z
        .object({
          state: z.literal("present"),
          fan_id: z.string(),
          revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        })
        .strict(),
    ]),
    fan_mapping: z.discriminatedUnion("state", [
      z.object({ state: z.literal("absent") }).strict(),
      z.object({ state: z.literal("present"), host_account_id: z.string() }).strict(),
    ]),
    security: z.enum(["active", "revoked", "deleted"]),
    reassign: z.boolean(),
  })
  .strict();
/** Model classifications only; no verification, mutation, replay or atomicity guarantee. */
export function decideFanHostLinkConflict(input: unknown) {
  try {
    const value = observations.parse(input),
      intent = parseFanHostIntent(value.intent);
    if (Object.entries(value.scope).some(([key, v]) => intent[key as keyof typeof intent] !== v))
      return "unavailable";
    parseFanHostIntent({ ...intent, operation_id: value.host_account_id });
    if (intent.purpose === "link_existing_host" && intent.host_account_id !== value.host_account_id)
      return "unavailable";
    const host = value.host_mapping,
      fan = value.fan_mapping;
    if (host.state === "present") parseFanHostIntent({ ...intent, fan_id: host.fan_id });
    if (fan.state === "present")
      parseFanHostIntent({ ...intent, operation_id: fan.host_account_id });
    if (value.security === "revoked") return "denied";
    if (value.security === "deleted" || value.reassign) return "recovery_required";
    if (
      (host.state === "present" && host.fan_id !== intent.fan_id) ||
      (fan.state === "present" && fan.host_account_id !== value.host_account_id)
    )
      return "conflict";
    if (
      intent.purpose === "link_existing_host" &&
      (host.state === "absent" ? 0 : host.revision) !== intent.expected_mapping_revision
    )
      return "unavailable";
    if (host.state === "absent" && fan.state === "absent") return "needs_atomic_mapping_check";
    if (host.state === "present" && fan.state === "present") return "unchanged_candidate";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}
