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
 * Restores from a snapshot when `restoreSnapshotId` is provided —
 * snapshots already encode resources/runtime so we skip our defaults
 * in that case.
 *
 * @param config - VercelSandboxConfig (timeout, vcpus, runtime,
 *                 restoreSnapshotId, source, ports, env, etc.)
 * @returns The sandbox creation result (instance + response shape)
 * @throws Error if sandbox creation fails
 */
export async function createSandbox(
  config: CreateSandboxParams = {},
): Promise<SandboxCreateResult> {
  const sandbox = await VercelSandbox.create(
    config.restoreSnapshotId
      ? {
          ...config,
          timeout: config.timeout ?? DEFAULT_TIMEOUT,
        }
      : {
          vcpus: DEFAULT_VCPUS,
          timeout: config.timeout ?? DEFAULT_TIMEOUT,
          runtime: DEFAULT_RUNTIME,
          ...config,
        },
  );

  return {
    sandbox,
    response: {
      sandboxId: sandbox.name,
      sandboxStatus: sandbox.sdkStatus,
      timeout: sandbox.timeout,
      createdAt: sandbox.createdAt?.toISOString() ?? new Date().toISOString(),
    },
  };
}
