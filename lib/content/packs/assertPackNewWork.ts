import { assertPackQuoteConfiguration } from "./assertPackQuoteConfiguration";
import { getPackExecutionConfiguration } from "./getPackExecutionConfiguration";

/** New effects only: accepted provider receipts retain their separate recovery path. */
export function assertPackNewWork(quote: Parameters<typeof assertPackQuoteConfiguration>[0]) {
  assertPackQuoteConfiguration(quote);
  const current = getPackExecutionConfiguration();
  const problems: string[] = [];
  for (const [task, model] of Object.entries(current.models)) {
    if (task === "analysis_endpoint") continue;
    const entry = current.model_evidence.tasks[task as keyof typeof current.model_evidence.tasks];
    if (!entry) {
      problems.push(`${task} (${model}): missing task evidence`);
      continue;
    }
    const reasons: string[] = [];
    if (entry.model !== model) reasons.push("model evidence does not match the configured route");
    if (task === "analysis" && entry.endpoint !== current.models.analysis_endpoint)
      reasons.push("analysis endpoint does not match evidence");
    if (entry.capability !== "verified") reasons.push("task capability unverified");
    if (entry.commercial_basis !== "verified")
      reasons.push(`commercial basis ${entry.commercial_basis}`);
    if (entry.account_availability !== "verified") reasons.push("account availability unverified");
    if (entry.lifecycle !== "supported") reasons.push(`lifecycle ${entry.lifecycle}`);
    if (!entry.evidence.length) reasons.push("missing evidence sources");
    if (!(Date.parse(entry.valid_until) > Date.now())) reasons.push("evidence expired or undated");
    if (reasons.length) problems.push(`${task} (${model}): ${reasons.join(", ")}`);
  }
  if (problems.length)
    throw new Error(
      `Pack model suitability is not verified. ${problems.join("; ")}. No new work authorized; review server evidence and request a fresh estimate. No substitution was made.`,
    );
}
