import ms from "ms";
import { Sandbox } from "@vercel/sandbox";

export interface SandboxCreatedResponse {
  sandboxId: Sandbox["sandboxId"];
  sandboxStatus: Sandbox["status"];
  timeout: Sandbox["timeout"];
  createdAt: string;
}

/**
 * Creates a Vercel Sandbox and returns its info.
 *
 * The sandbox is left running so that commands can be executed via the runSandboxCommand task.
 *
 * @returns The sandbox creation response
 * @throws Error if sandbox creation fails
 */
export async function createSandbox(): Promise<SandboxCreatedResponse> {
  const sandbox = await Sandbox.create({
    resources: { vcpus: 4 },
    timeout: ms("10m"),
    runtime: "node22",
  });

  return {
    sandboxId: sandbox.sandboxId,
    sandboxStatus: sandbox.status,
    timeout: sandbox.timeout,
    createdAt: sandbox.createdAt.toISOString(),
  };
}
