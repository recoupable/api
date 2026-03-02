import ms from "ms";
import { Sandbox, APIError } from "@vercel/sandbox";

export interface SandboxCreatedResponse {
  sandboxId: Sandbox["sandboxId"];
  sandboxStatus: Sandbox["status"];
  timeout: Sandbox["timeout"];
  createdAt: string;
}

export interface SandboxCreateResult {
  sandbox: Sandbox;
  response: SandboxCreatedResponse;
}

/** Extract CreateSandboxParams from Sandbox.create method signature */
export type CreateSandboxParams = NonNullable<Parameters<typeof Sandbox.create>[0]>;

const DEFAULT_TIMEOUT = ms("30m");
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
export async function createSandbox(
  params: CreateSandboxParams = {},
): Promise<SandboxCreateResult> {
  const hasSnapshotSource =
    params.source && "type" in params.source && params.source.type === "snapshot";

  // Pass params directly to SDK - it handles all the type variants
  const createParams = hasSnapshotSource
    ? {
        ...params,
        timeout: params.timeout ?? DEFAULT_TIMEOUT,
      }
    : {
        resources: { vcpus: DEFAULT_VCPUS },
        timeout: params.timeout ?? DEFAULT_TIMEOUT,
        runtime: DEFAULT_RUNTIME,
        ...params,
      };

  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.create(createParams);
  } catch (error) {
    if (error instanceof APIError) {
      const apiJson = error.json as Record<string, unknown> | undefined;
      const detail =
        (apiJson?.error as Record<string, unknown>)?.message ??
        error.text ??
        error.message;

      console.error("Sandbox.create failed", {
        status: error.response?.status,
        json: apiJson,
        text: error.text,
        params: createParams,
      });

      throw new Error(`Sandbox creation failed: ${detail}`);
    }
    throw error;
  }

  return {
    sandbox,
    response: {
      sandboxId: sandbox.sandboxId,
      sandboxStatus: sandbox.status,
      timeout: sandbox.timeout,
      createdAt: sandbox.createdAt.toISOString(),
    },
  };
}
