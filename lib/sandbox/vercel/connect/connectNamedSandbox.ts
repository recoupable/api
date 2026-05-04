import type { Sandbox } from "../../interface";
import { VercelSandbox } from "../sandbox/VercelSandbox";
import type { VercelState } from "../state";
import { buildCreateConfig } from "./buildCreateConfig";
import { getRemainingTimeout } from "./getRemainingTimeout";
import { getSandboxName } from "./getSandboxName";
import { isSandboxNotFoundError } from "./isSandboxNotFoundError";
import type { ConnectOptions } from "./types";

export async function connectNamedSandbox(
  state: VercelState,
  options?: ConnectOptions,
): Promise<Sandbox> {
  const sandboxName = getSandboxName(state);
  if (!sandboxName) {
    throw new Error("Persistent sandbox name is required");
  }

  const remainingTimeout = getRemainingTimeout(state.expiresAt);

  try {
    return await VercelSandbox.connect(sandboxName, {
      env: options?.env,
      githubToken: options?.githubToken,
      hooks: options?.hooks,
      remainingTimeout,
      ports: options?.ports,
      resume: options?.resume,
    });
  } catch (error) {
    if (!options?.createIfMissing || !isSandboxNotFoundError(error)) {
      throw error;
    }
  }

  return VercelSandbox.create(buildCreateConfig(state, options));
}
