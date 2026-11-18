import type { PackLaunchFence } from "@/lib/content/packs/fence/packFenceTypes";
import { assertPackExecutionIdentity } from "@/lib/content/packs/fence/assertPackExecutionIdentity";
import { PackFenceError } from "@/lib/content/packs/fence/PackFenceError";
import { preparePackStep } from "../preparePackStep";
import { producePackAssetStep } from "../producePackAssetStep";
import { settleBoundedPackStep } from "../settleBoundedPackStep";
import { readPackFoundationStep } from "./readPackFoundationStep";
import { planPackFoundationStep } from "./planPackFoundationStep";
import { bindPackFoundationFilesStep } from "./bindPackFoundationFilesStep";
import { persistPackFoundationStep } from "./persistPackFoundationStep";
import { signPackFoundationFileStep } from "./signPackFoundationFileStep";
import type { PackActor } from "@/lib/content/packs/packTypes";
import type { PackFoundationServices } from "@/lib/content/packs/foundation/packFoundationServices";
/** Unwired single-admitted-run ports. Actor/job are passed explicitly to every effect step. */
export function createPackFoundationServices(
  actor: PackActor,
  jobId: string,
  execution?: PackLaunchFence,
): PackFoundationServices {
  if (actor.packProtocol === 2 && !execution)
    throw new PackFenceError("Foundation requires original execution admission");
  const attempts = new Map<string, number>();
  const scope = (input: PackActor, id: string) => {
    if (
      id !== jobId ||
      input.accountId !== actor.accountId ||
      input.organizationId !== actor.organizationId ||
      input.packProtocol !== actor.packProtocol
    )
      throw new Error("Foundation service scope mismatch");
  };
  return {
    read: (a, id) => {
      scope(a, id);
      return readPackFoundationStep(a, id).then(saved => {
        if (a.packProtocol === 2) {
          assertPackExecutionIdentity(saved.job, execution);
          for (const asset of saved.assets)
            if (!attempts.has(asset.id)) attempts.set(asset.id, asset.attempt);
        }
        return saved;
      });
    },
    prepare: (a, id) => {
      scope(a, id);
      return preparePackStep(a, id, execution);
    },
    persist: (a, job, record) => {
      scope(a, job.id);
      if (a.packProtocol === 2) assertPackExecutionIdentity(job, execution);
      return persistPackFoundationStep(a, job, record);
    },
    produce: (a, job, id) => {
      scope(a, job.id);
      if (a.packProtocol === 2) {
        assertPackExecutionIdentity(job, execution);
        return producePackAssetStep(a, job, id, false, attempts.get(id));
      }
      return producePackAssetStep(a, job, id);
    },
    settle: (a, id, error, suppliedExecution) => {
      scope(a, id);
      if (
        a.packProtocol === 2 &&
        (!suppliedExecution ||
          suppliedExecution.execution_id !== execution!.execution_id ||
          suppliedExecution.execution_version !== execution!.execution_version ||
          suppliedExecution.expected_revision !== execution!.expected_revision)
      )
        throw new PackFenceError("Foundation settlement execution mismatch");
      return a.packProtocol === 2
        ? settleBoundedPackStep(a, id, error, suppliedExecution)
        : settleBoundedPackStep(a, id, error);
    },
    createPlan: (snapshot, selection) => {
      scope(actor, snapshot.job.id);
      if (actor.packProtocol === 2) assertPackExecutionIdentity(snapshot.job, execution);
      return planPackFoundationStep(snapshot, selection);
    },
    bindFiles: (plan, asset) => bindPackFoundationFilesStep(actor, jobId, plan, asset),
    signFile: file => signPackFoundationFileStep(actor, jobId, file),
  };
}
