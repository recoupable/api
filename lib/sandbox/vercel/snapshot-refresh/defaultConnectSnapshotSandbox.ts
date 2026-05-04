import { connectSandbox, type SandboxConnectConfig } from "../../factory";
import type { SnapshotSandbox } from "./types";

export function defaultConnectSnapshotSandbox(
  config: SandboxConnectConfig,
): Promise<SnapshotSandbox> {
  return connectSandbox(config);
}
