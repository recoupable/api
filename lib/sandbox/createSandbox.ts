import ms from "ms";
import { VercelSandbox, type VercelSandboxConfig } from "@/lib/sandbox/vercel";

export interface SandboxCreatedResponse {
  sandboxId: VercelSandbox["name"];
  sandboxStatus: string;
  timeout: VercelSandbox["timeout"];
  createdAt: string;
}

export interface SandboxCreateResult {
  sandbox: VercelSandbox;
  response: SandboxCreatedResponse;
}

/** Parameters for the api-side createSandbox helper. Wraps the abstraction's
 *  VercelSandboxConfig so callers do not need to import it directly. */
export type CreateSandboxParams = VercelSandboxConfig;

const DEFAULT_TIMEOUT = ms("30m");
const DEFAULT_VCPUS = 4;
const DEFAULT_RUNTIME = "node22" as const;

/**
 * Creates a Vercel Sandbox via the open-agents abstraction and returns
 * its info. The sandbox is left running so subsequent prompts can run
 * against it.
 *
 * Note: VercelSandbox.create applies its own defaults for vcpus and
 * runtime (vcpus=4, runtime="node22") regardless of source — those
 * apply to the runtime resources of the new sandbox even when restoring
 * from a snapshot. We pass our preferred defaults explicitly so api's
 * intent is documented at the call site.
 *
 * @param config - VercelSandboxConfig (timeout, vcpus, runtime,
 *                 restoreSnapshotId, source, ports, env, etc.)
 * @returns The sandbox creation result (instance + response shape)
 * @throws Error if sandbox creation fails
 */
export async function createSandbox(
  config: CreateSandboxParams = {},
): Promise<SandboxCreateResult> {
  const sandbox = await VercelSandbox.create({
    vcpus: DEFAULT_VCPUS,
    runtime: DEFAULT_RUNTIME,
    timeout: DEFAULT_TIMEOUT,
    ...config,
  });

  return {
    sandbox,
    response: {
      sandboxId: sandbox.name,
      sandboxStatus: sandbox.sdkStatus,
      timeout: sandbox.timeout,
      createdAt: sandbox.createdAt.toISOString(),
    },
  };
}
