import { Sandbox } from "@vercel/sandbox";

/**
 * Response from creating a sandbox.
 * Uses Sandbox class types from @vercel/sandbox SDK.
 */
export interface SandboxCreatedResponse {
  sandboxId: Sandbox["sandboxId"];
  status: Sandbox["status"];
  timeout: Sandbox["timeout"];
  createdAt: string;
}

/**
 * Creates a new ephemeral sandbox environment using Vercel Sandbox SDK.
 *
 * @returns The created sandbox details
 * @throws Error if sandbox creation fails
 */
export async function createSandbox(): Promise<SandboxCreatedResponse> {
  const sandbox = await Sandbox.create();

  return {
    sandboxId: sandbox.sandboxId,
    status: sandbox.status,
    timeout: sandbox.timeout,
    createdAt: sandbox.createdAt.toISOString(),
  };
}
