import { z } from "zod";
import { contextEvidenceKindSchema } from "../schema";

export const contextCorrectionActorSchema = z.enum(["customer", "workspace_admin", "service"]);

export const contextCorrectionFieldSchema = z.enum([
  "spotify_track_id",
  "isrc",
  "credited_artist_order",
  "display_title",
  "release_date",
  "customer_note",
]);

/** A proposed correction: who proposes it, what it touches, and what it claims to be. */
export const contextCorrectionSchema = z.strictObject({
  actor: contextCorrectionActorSchema,
  field: contextCorrectionFieldSchema,
  current_evidence_kind: contextEvidenceKindSchema,
  proposed_evidence_kind: contextEvidenceKindSchema,
});

export type ContextCorrection = z.infer<typeof contextCorrectionSchema>;

export type ContextCorrectionReason =
  | "creative_output_cannot_become_factual"
  | "customer_assertion_cannot_become_factual"
  | "customer_corrections_are_private_assertions"
  | "customer_note_is_customer_authored"
  | "shared_identity_not_customer_overridable"
  | "shared_identity_dispute_requires_review"
  | "service_corrections_require_source_observation"
  | "private_assertion_allowed"
  | "source_observation_allowed";

export interface ContextCorrectionDecision {
  decision: "allowed" | "denied" | "requires_review";
  reason: ContextCorrectionReason;
  /** Where an allowed correction is recorded; never the shared canonical row for a customer. */
  recorded_as: "private_customer_assertion" | "shared_source_observation" | null;
}

const SHARED_IDENTITY_FIELDS = new Set<ContextCorrection["field"]>([
  "spotify_track_id",
  "isrc",
  "credited_artist_order",
]);
const FACTUAL_KINDS = new Set<ContextCorrection["proposed_evidence_kind"]>([
  "observation",
  "estimate",
  "interpretation",
]);

/**
 * Decide whether a proposed correction may be applied, and as what.
 *
 * Encodes the ownership rules from recoupable/app#2118: shared canonical identity
 * (Spotify ID, ISRC, credited artist order) is never rewritten by an ordinary
 * customer override; a workspace admin can only raise a review; the service
 * changes it only through a source observation. Creative proposals and customer
 * assertions never become factual research by relabelling. Customer-side
 * corrections are recorded as private assertions scoped to the workspace.
 * This is a pure decision; persistence of corrections belongs to #2124.
 *
 * @param input - The proposed correction, validated with `contextCorrectionSchema`.
 * @returns The decision, a stable reason code and where an allowed change is recorded.
 */
export function resolveContextCorrectionAuthority(input: unknown): ContextCorrectionDecision {
  const correction = contextCorrectionSchema.parse(input);
  const proposedFactual = FACTUAL_KINDS.has(correction.proposed_evidence_kind);
  if (correction.current_evidence_kind === "creative_proposal" && proposedFactual)
    return deny("creative_output_cannot_become_factual");
  if (correction.current_evidence_kind === "customer_assertion" && proposedFactual)
    return deny("customer_assertion_cannot_become_factual");
  const customerSide = correction.actor !== "service";
  if (customerSide && correction.proposed_evidence_kind !== "customer_assertion")
    return deny("customer_corrections_are_private_assertions");
  if (!customerSide && correction.field === "customer_note")
    return deny("customer_note_is_customer_authored");
  if (SHARED_IDENTITY_FIELDS.has(correction.field)) {
    if (correction.actor === "customer") return deny("shared_identity_not_customer_overridable");
    if (correction.actor === "workspace_admin")
      return review("shared_identity_dispute_requires_review");
  }
  if (customerSide)
    return {
      decision: "allowed",
      reason: "private_assertion_allowed",
      recorded_as: "private_customer_assertion",
    };
  return correction.proposed_evidence_kind === "observation"
    ? {
        decision: "allowed",
        reason: "source_observation_allowed",
        recorded_as: "shared_source_observation",
      }
    : review("service_corrections_require_source_observation");
}

/**
 * Build a denied decision.
 *
 * @param reason - Stable reason code.
 * @returns The denied decision.
 */
function deny(reason: ContextCorrectionReason): ContextCorrectionDecision {
  return { decision: "denied", reason, recorded_as: null };
}

/**
 * Build a requires-review decision.
 *
 * @param reason - Stable reason code.
 * @returns The review decision.
 */
function review(reason: ContextCorrectionReason): ContextCorrectionDecision {
  return { decision: "requires_review", reason, recorded_as: null };
}
