import { createSandbox, type SandboxCreateResult } from "@/lib/sandbox/createSandbox";

export type SandboxWithFallbackResult = SandboxCreateResult & { fromSnapshot: boolean };

/**
 * Attempts to create a sandbox from the given snapshot, falling back to a fresh sandbox on failure.
 * If no snapshotId is provided, creates a fresh sandbox directly.
 *
 * @param snapshotId - Optional snapshot ID to restore from
 * @returns The sandbox creation result with fromSnapshot flag
 */
export async function createSandboxWithFallback(
  snapshotId: string | undefined,
): Promise<SandboxWithFallbackResult> {
  if (snapshotId) {
    try {
      const result = await createSandbox({ source: { type: "snapshot", snapshotId } });
      return { ...result, fromSnapshot: true };
    } catch (error) {
      console.error("Snapshot sandbox creation failed, falling back to fresh sandbox:", error);
    }
  }
  const result = await createSandbox({});
  return { ...result, fromSnapshot: false };
}
