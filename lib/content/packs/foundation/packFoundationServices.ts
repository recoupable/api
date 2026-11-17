import type { PackActor, PackFile, PackJob, PackSnapshot } from "../packTypes";
import type { PackFoundationRecord } from "./packFoundationSchema";
/** Ports must be durable steps before Workflow wiring; none are registered by this candidate. */
export type PackFoundationServices = {
  prepare: (actor: PackActor, jobId: string) => Promise<{ job: PackJob; assetIds: string[] }>;
  read: (actor: PackActor, jobId: string) => Promise<PackSnapshot>;
  persist: (actor: PackActor, job: PackJob, record: PackFoundationRecord) => Promise<unknown>;
  produce: (actor: PackActor, job: PackJob, assetId: string) => Promise<unknown>;
  readFile: (file: PackFile) => Promise<Uint8Array>;
  signFile: (file: PackFile) => Promise<string>;
  settle: (actor: PackActor, jobId: string, error?: string) => Promise<unknown>;
};
