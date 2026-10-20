import {
  contextPilotConfigSchema,
  type ContextPilotConfig,
  type ContextPilotConfigField,
} from "./contextPilotConfigSchema";

export interface ContextPilotActivation {
  /** `configured` is a prerequisite for paid activation, not permission to spend. */
  paid_activation: "blocked" | "configured";
  unresolved_fields: ContextPilotConfigField[];
  /** Unpaid reads, classification and coverage checks never wait on pilot configuration. */
  unpaid_operations: "allowed";
}

/**
 * Evaluate whether a pilot configuration still blocks paid activation.
 *
 * Any `"unresolved"` field blocks paid activation and is listed by name so the
 * owner can resolve it. Unpaid engineering continues regardless. `configured`
 * means every field has a concrete value; it does not reserve or spend credits
 * (#2123/#2105 own reservation) and does not enable any provider.
 *
 * @param input - A pilot configuration; it is re-validated here.
 * @returns The activation state, the unresolved field names and the unpaid allowance.
 */
export function evaluateContextPilotActivation(
  input: ContextPilotConfig | unknown,
): ContextPilotActivation {
  const config = contextPilotConfigSchema.parse(input);
  const unresolved = (
    Object.keys(contextPilotConfigSchema.shape) as ContextPilotConfigField[]
  ).filter(field => config[field] === "unresolved");
  return {
    paid_activation: unresolved.length > 0 ? "blocked" : "configured",
    unresolved_fields: unresolved,
    unpaid_operations: "allowed",
  };
}
