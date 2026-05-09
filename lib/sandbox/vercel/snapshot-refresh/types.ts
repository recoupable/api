import type { SandboxConnectConfig } from "../../factory";
import type { ExecResult, SnapshotResult } from "../../interface";

export interface SnapshotSandbox {
  workingDirectory: string;
  exec(command: string, cwd: string, timeoutMs: number): Promise<ExecResult>;
  stop(): Promise<void>;
  snapshot?(): Promise<SnapshotResult>;
}

export type SnapshotSandboxConnector = (config: SandboxConnectConfig) => Promise<SnapshotSandbox>;

export interface RefreshBaseSnapshotOptions {
  baseSnapshotId: string;
  commands?: string[];
  sandboxTimeoutMs: number;
  commandTimeoutMs?: number;
  ports?: number[];
  env?: Record<string, string>;
  log?: (message: string) => void;
  /**
   * Optional persistent name for the build sandbox. The Vercel API records
   * this name against any snapshots the sandbox creates, which lets callers
   * filter with `Snapshot.list({ name })` later.
   */
  sandboxName?: string;
  /** Optional token for authenticated git operations inside the build sandbox. */
  githubToken?: string;
}

export interface RefreshBaseSnapshotCommandResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

export interface RefreshBaseSnapshotResult {
  sourceSnapshotId: string;
  snapshotId: string;
  commandResults: RefreshBaseSnapshotCommandResult[];
}

export interface RefreshBaseSnapshotDependencies {
  connectSandbox?: SnapshotSandboxConnector;
}
