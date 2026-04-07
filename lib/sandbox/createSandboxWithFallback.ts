import { createSandbox, type SandboxCreatedResponse } from "@/lib/sandbox/createSandbox";

/**
 * Attempts to create a sandbox from the given snapshot, falling back to a fresh sandbox on failure.
 * If no snapshotId is provided, creates a fresh sandbox directly.
 *
 * @param snapshotId - Optional snapshot ID to restore from
 * @returns The sandbox creation response
 */
export async function createSandboxWithFallback(
  snapshotId: string | undefined,
): Promise<SandboxCreatedResponse> {
  if (snapshotId) {
    try {
      return (await createSandbox({ source: { type: "snapshot", snapshotId } })).response;
    } catch (error) {
      console.error(
        "Snapshot sandbox creation failed, falling back to fresh sandbox:",
        error,
      );
    }
  }
  return (await createSandbox({})).response;
}
