import type { PackActor, PackAsset, PackFile, PackJob, PackSnapshot } from "../packTypes";
import type {
  PackFoundationPlan,
  PackFoundationRecord,
  PackFoundationSelection,
} from "./packFoundationSchema";
/** Ports must be durable steps before Workflow wiring; none are registered by this candidate. */
export type PackFoundationServices = {
  prepare: (actor: PackActor, jobId: string) => Promise<{ job: PackJob; assetIds: string[] }>;
  read: (actor: PackActor, jobId: string) => Promise<PackSnapshot>;
  persist: (actor: PackActor, job: PackJob, record: PackFoundationRecord) => Promise<unknown>;
  produce: (actor: PackActor, job: PackJob, assetId: string) => Promise<unknown>;
  createPlan: (
    snapshot: PackSnapshot,
    selection: PackFoundationSelection,
  ) => Promise<PackFoundationPlan>;
  bindFiles: (
    plan: PackFoundationPlan,
    asset: PackAsset | undefined,
  ) => Promise<PackFoundationRecord>;
  signFile: (file: PackFile) => Promise<string>;
  settle: (actor: PackActor, jobId: string, error?: string) => Promise<unknown>;
};

export type PackFoundationBatchState = {
  savedJob?: PackJob;
  foundation?: PackFoundationRecord;
  blockedAssetIds: string[];
  settlementDeferred: boolean;
  references: string[];
};
