import { getPackModelEvidence } from "./getPackModelEvidence";
import { getPackExecutionConfiguration } from "./getPackExecutionConfiguration";
import { getPackConfigurationDigest } from "./getPackConfigurationDigest";
import type { PackModelTask, PackModelEvidence } from "./getPackModelEvidence";
/** Assessment of requested tasks, separate from existing execution identity and authorization. */
export function getPackModelReadiness(required: PackModelTask[]) {
  const registry = getPackModelEvidence();
  const config = getPackExecutionConfiguration();
  const tasks: Partial<
    Record<
      PackModelTask,
      {
        model: string;
        evidence: PackModelEvidence | null;
        issues: string[];
        restriction: string | null;
      }
    >
  > = {};
  for (const task of required) {
    const model = config.models[task];
    const entry = registry.tasks[task];
    const matches =
      !!entry &&
      entry.model === model &&
      (task !== "analysis" || entry.endpoint === config.models.analysis_endpoint);
    const issues: string[] = [];
    let restriction: string | null = null;
    if (!matches) issues.push("missing evidence for the configured route");
    else {
      if (entry.capability !== "verified") issues.push(`task capability ${entry.capability}`);
      if (entry.commercial_basis !== "verified")
        issues.push(`commercial basis ${entry.commercial_basis}`);
      if (entry.account_availability !== "verified")
        issues.push(`account availability ${entry.account_availability}`);
      if (entry.lifecycle !== "supported") issues.push(`lifecycle ${entry.lifecycle}`);
      if (!entry.evidence.length) issues.push("missing evidence sources");
      if (!(Date.parse(entry.valid_until) > Date.now())) issues.push("evidence expired or undated");
      // Expiry does not turn a recorded restriction into permission.
      if (entry.commercial_basis === "restricted") restriction = "commercial use restricted";
      if (entry.lifecycle === "retired") restriction = "model retired";
    }
    tasks[task] = { model, evidence: entry ?? null, issues, restriction };
  }
  const report = {
    version: registry.version,
    reviewed_at: registry.reviewed_at,
    assessment_only: true as const,
    ready: Object.values(tasks).every(task => task.issues.length === 0),
    execution_policy:
      "Recorded commercial restrictions and retirement block matching new provider effects; unknown evidence and deprecation alone do not change existing execution authorization.",
    tasks,
  };
  return { ...report, digest: getPackConfigurationDigest(report) };
}
