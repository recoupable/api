import type { Sandbox } from "../../interface";
import { VercelSandbox } from "../sandbox/VercelSandbox";
import type { VercelState } from "../state";
import { buildCreateConfig } from "./buildCreateConfig";
import { connectNamedSandbox } from "./connectNamedSandbox";
import { getSandboxName } from "./getSandboxName";
import type { ConnectOptions } from "./types";

/**
 * Connect to the Vercel-backed cloud sandbox based on the provided state.
 *
 * - If `sandboxName` is present, reconnects to the named persistent sandbox
 * - If `snapshotId` is present without `sandboxName`, restores from a legacy snapshot
 * - If `source` is present, creates a new sandbox and prepares the repo
 * - Otherwise, creates an empty sandbox
 */
export async function connectVercel(
  state: VercelState,
  options?: ConnectOptions,
): Promise<Sandbox> {
  const sandboxName = getSandboxName(state);

  if (sandboxName && !options?.forceCreate) {
    return connectNamedSandbox(state, options);
  }

  return VercelSandbox.create(buildCreateConfig(state, options));
}
