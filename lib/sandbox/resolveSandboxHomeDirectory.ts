import type { Sandbox } from "@/lib/sandbox/interface";

const DEFAULT_HOME_DIRECTORY = "/root";
const HOME_RESOLUTION_TIMEOUT_MS = 5_000;

/**
 * Probes the sandbox's `$HOME` directory by running `printf %s "$HOME"`.
 * Falls back to `/root` (the convention for the open-agents base
 * snapshot) when the probe fails or returns an empty value.
 *
 * @param sandbox - The connected sandbox handle.
 * @returns The trimmed `$HOME` path, or `/root` as a fallback.
 */
export async function resolveSandboxHomeDirectory(sandbox: Sandbox): Promise<string> {
  const result = await sandbox.exec(
    'printf %s "$HOME"',
    sandbox.workingDirectory,
    HOME_RESOLUTION_TIMEOUT_MS,
  );
  const homeDirectory = result.success ? result.stdout.trim() : "";
  return homeDirectory || DEFAULT_HOME_DIRECTORY;
}
