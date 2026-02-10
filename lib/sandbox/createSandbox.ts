import ms from "ms";
import { Sandbox } from "@vercel/sandbox";

export interface SandboxCreatedResponse {
  sandboxId: Sandbox["sandboxId"];
  sandboxStatus: Sandbox["status"];
  timeout: Sandbox["timeout"];
  createdAt: string;
}

/** Extract CreateSandboxParams from Sandbox.create method signature */
export type CreateSandboxParams = NonNullable<Parameters<typeof Sandbox.create>[0]>;

const DEFAULT_TIMEOUT = ms("10m");
const DEFAULT_VCPUS = 4;
const DEFAULT_RUNTIME = "node22";

/**
 * Creates a Vercel Sandbox and returns its info.
 *
 * The sandbox is left running so that commands can be executed via the runSandboxCommand task.
 * Accepts the same parameters as Sandbox.create from @vercel/sandbox.
 *
 * @param params - Sandbox creation parameters (source, timeout, resources, runtime, ports)
 * @returns The sandbox creation response
 * @throws Error if sandbox creation fails
 */
export async function createSandbox(params: CreateSandboxParams = {}): Promise<SandboxCreatedResponse> {
  const hasSnapshotSource = params.source && "type" in params.source && params.source.type === "snapshot";

  // Pass params directly to SDK - it handles all the type variants
  const sandbox = await Sandbox.create(
    hasSnapshotSource
      ? {
          ...params,
          timeout: params.timeout ?? DEFAULT_TIMEOUT,
        }
      : {
          resources: { vcpus: DEFAULT_VCPUS },
          timeout: params.timeout ?? DEFAULT_TIMEOUT,
          runtime: DEFAULT_RUNTIME,
          ...params,
        },
  );

  return {
    sandboxId: sandbox.sandboxId,
    sandboxStatus: sandbox.status,
    timeout: sandbox.timeout,
    createdAt: sandbox.createdAt.toISOString(),
  };
}
