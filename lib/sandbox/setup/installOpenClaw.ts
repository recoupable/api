import type { Sandbox } from "@vercel/sandbox";
import type { SetupDeps } from "./types";

/**
 * Installs OpenClaw CLI globally in the sandbox.
 * Idempotent -- skips if already installed.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param deps - Logging dependencies
 */
export async function installOpenClaw(sandbox: Sandbox, deps: SetupDeps): Promise<void> {
  const check = await sandbox.runCommand({
    cmd: "which",
    args: ["openclaw"],
  });

  if (check.exitCode === 0) {
    deps.log("OpenClaw CLI already installed, skipping");
    return;
  }

  deps.log("Installing OpenClaw CLI globally");

  const installCLI = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "-g", "openclaw@latest"],
    sudo: true,
  });

  if (installCLI.exitCode !== 0) {
    const stdout = (await installCLI.stdout()) || "";
    const stderr = (await installCLI.stderr()) || "";
    deps.error("Failed to install OpenClaw CLI", {
      exitCode: installCLI.exitCode,
      stdout,
      stderr,
    });
    throw new Error("Failed to install OpenClaw CLI");
  }

  deps.log("OpenClaw installation complete");
}
