import { Sandbox } from "@vercel/sandbox";
import type { SandboxCreatedResponse } from "./createSandbox";

/**
 * Gets the current status of a sandbox from the Vercel API.
 *
 * @param sandboxId - The name/ID of the sandbox to get status for
 * @returns The sandbox status response or null if not found/error
 */
export async function getSandboxStatus(sandboxId: string): Promise<SandboxCreatedResponse | null> {
  try {
    const sandbox = await Sandbox.get({ name: sandboxId });

    return {
      sandboxId: sandbox.name,
      sandboxStatus: sandbox.status,
      timeout: sandbox.timeout,
      createdAt: sandbox.createdAt.toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching sandbox ${sandboxId}:`, error);
    return null;
  }
}
