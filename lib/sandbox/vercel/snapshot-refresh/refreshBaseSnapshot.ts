import { defaultConnectSnapshotSandbox } from "./defaultConnectSnapshotSandbox";
import { formatCommandFailure } from "./formatCommandFailure";
import type {
  RefreshBaseSnapshotCommandResult,
  RefreshBaseSnapshotDependencies,
  RefreshBaseSnapshotOptions,
  RefreshBaseSnapshotResult,
  SnapshotSandbox,
} from "./types";

export const DEFAULT_BASE_SNAPSHOT_COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

export async function refreshBaseSnapshot(
  options: RefreshBaseSnapshotOptions,
  dependencies: RefreshBaseSnapshotDependencies = {},
): Promise<RefreshBaseSnapshotResult> {
  const commands = options.commands?.filter(command => command.trim().length > 0) ?? [];
  const commandTimeoutMs = options.commandTimeoutMs ?? DEFAULT_BASE_SNAPSHOT_COMMAND_TIMEOUT_MS;
  const log = options.log ?? (() => {});
  const connectSnapshotSandbox = dependencies.connectSandbox ?? defaultConnectSnapshotSandbox;

  let sandbox: SnapshotSandbox | null = null;
  let snapshotCreated = false;

  try {
    log(`Creating sandbox from base snapshot ${options.baseSnapshotId}.`);
    // Skip git init so the new base image does not ship `.git` in /vercel/sandbox
    // (would break `git clone … .` for agent sandboxes).
    sandbox = await connectSnapshotSandbox({
      state: {
        type: "vercel",
        ...(options.sandboxName ? { sandboxName: options.sandboxName } : {}),
      },
      options: {
        baseSnapshotId: options.baseSnapshotId,
        timeout: options.sandboxTimeoutMs,
        persistent: false,
        skipGitWorkspaceBootstrap: true,
        ...(options.sandboxName ? { forceCreate: true } : {}),
        ...(options.githubToken !== undefined && {
          githubToken: options.githubToken,
        }),
        ...(options.ports !== undefined && { ports: options.ports }),
        ...(options.env !== undefined && { env: options.env }),
      },
    });

    if (!sandbox.snapshot) {
      throw new Error("Configured sandbox provider does not support snapshots.");
    }

    const commandResults: RefreshBaseSnapshotCommandResult[] = [];

    for (const [index, command] of commands.entries()) {
      log(`Running command ${index + 1}/${commands.length}: ${command}`);

      const result = await sandbox.exec(command, sandbox.workingDirectory, commandTimeoutMs);

      commandResults.push({
        command,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        truncated: result.truncated,
      });

      if (!result.success) {
        throw new Error(formatCommandFailure(command, result));
      }
    }

    log("Creating snapshot from prepared sandbox.");
    const snapshot = await sandbox.snapshot();
    snapshotCreated = true;
    log(`Created snapshot ${snapshot.snapshotId}.`);

    return {
      sourceSnapshotId: options.baseSnapshotId,
      snapshotId: snapshot.snapshotId,
      commandResults,
    };
  } finally {
    if (sandbox && !snapshotCreated) {
      try {
        await sandbox.stop();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`Failed to stop sandbox after refresh attempt: ${message}`);
      }
    }
  }
}
