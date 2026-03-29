import ms from "ms";
import { Sandbox } from "@vercel/sandbox";

export interface SandboxCreatedResponse {
  sandboxId: string;
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
 * The sandbox is left running so that prompts can be executed via the prompt_sandbox tool.
 * Accepts the same parameters as Sandbox.create from @vercel/sandbox.
 *
 * Uses the name parameter for persistent sandbox identification when provided.
 *
 * @param params - Sandbox creation parameters (name, timeout, resources, runtime, ports)
 * @returns The sandbox creation response
 * @throws Error if sandbox creation fails
 */
export async function createSandbox(
  params: CreateSandboxParams = {},
): Promise<SandboxCreateResult> {
  const sandbox = await Sandbox.create({
    resources: { vcpus: DEFAULT_VCPUS },
    timeout: DEFAULT_TIMEOUT,
    runtime: DEFAULT_RUNTIME,
    ...params,
  });

  return {
    sandbox,
    response: {
      sandboxId: sandbox.name,
      sandboxStatus: sandbox.status,
      timeout: sandbox.timeout,
      createdAt: sandbox.createdAt.toISOString(),
    },
  };
}
