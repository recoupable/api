import type { getWorld } from "workflow/runtime";
import { WorkflowRunNotFoundError, RunExpiredError } from "workflow/errors";
import { hydrateProjectionEvidence } from "./hydrateProjectionEvidence";
import { readCanonicalProjectionSnapshot } from "./readCanonicalProjectionSnapshot";
import { readProjectionEvidence } from "./readProjectionEvidence";
import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
import type { ProjectionEvidencePorts } from "./ProjectionEvidencePorts";
/** Explicit server dependency injection; importing this module never opens a World or reads keys. */
export function createProjectionEvidencePorts({
  world,
}: {
  world: Pick<
    ReturnType<typeof getWorld>,
    | "runs"
    | "steps"
    | "getEncryptionKeyForRun"
    | "getStreamInfo"
    | "getStreamChunks"
    | "listStreamsByRunId"
  >;
}): ProjectionEvidencePorts {
  async function resource<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
    return readProjectionEvidence(async () => {
      try {
        return await read();
      } catch (error) {
        if (WorkflowRunNotFoundError.is(error))
          throw new ProjectionEvidenceError("evidence_missing");
        if (RunExpiredError.is(error)) throw new ProjectionEvidenceError("evidence_expired");
        throw error;
      }
    }, signal);
  }
  return {
    async readRun(runId, signal) {
      const run = await resource(() => world.runs.get(runId, { resolveData: "all" }), signal);
      return {
        runId: run.runId,
        deploymentId: run.deploymentId,
        workflowName: run.workflowName,
        expiredAt: run.expiredAt,
        input: await hydrateProjectionEvidence(run.input, runId, world, signal),
      };
    },
    async readStep(runId, stepId, signal) {
      const step = await resource(
        () => world.steps.get(runId, stepId, { resolveData: "all" }),
        signal,
      );
      return {
        runId: step.runId,
        stepId: step.stepId,
        stepName: step.stepName,
        status: step.status,
        output: await hydrateProjectionEvidence(step.output, runId, world, signal),
      };
    },
    async readReceipt(runId, producerStepId, proofStepName, signal) {
      let cursor: string | undefined;
      let found: unknown;
      for (let pageCount = 0; pageCount < 10; pageCount++) {
        const page = await resource(
          () =>
            world.steps.list({ runId, resolveData: "none", pagination: { limit: 100, cursor } }),
          signal,
        );
        for (const candidate of page.data) {
          if (candidate.stepName !== proofStepName || candidate.status !== "completed") continue;
          const step = await resource(
            () => world.steps.get(runId, candidate.stepId, { resolveData: "all" }),
            signal,
          );
          const output = await hydrateProjectionEvidence(step.output, runId, world, signal);
          if (
            typeof output !== "object" ||
            output === null ||
            !("producerStepId" in output) ||
            output.producerStepId !== producerStepId
          )
            continue;
          if (found) throw new ProjectionEvidenceError("invalid_evidence");
          found = {
            runId: step.runId,
            stepId: step.stepId,
            stepName: step.stepName,
            status: step.status,
            output,
          };
        }
        if (!page.hasMore) return found;
        if (!page.cursor || page.cursor === cursor)
          throw new ProjectionEvidenceError("invalid_evidence");
        cursor = page.cursor;
      }
      throw new ProjectionEvidenceError("evidence_limit");
    },
    readCanonical: (runId, signal) => readCanonicalProjectionSnapshot(world, runId, signal),
  };
}
