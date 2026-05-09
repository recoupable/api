import type { VercelSandboxConfig } from "../config";
import type { VercelState } from "../state";
import { getSandboxName } from "./getSandboxName";
import type { ConnectOptions } from "./types";

export function buildCreateConfig(
  state: VercelState,
  options?: ConnectOptions,
): VercelSandboxConfig {
  const sandboxName = getSandboxName(state);

  return {
    ...(sandboxName ? { name: sandboxName } : {}),
    ...(state.source
      ? {
          source: {
            url: state.source.repo,
            branch: state.source.branch,
            token: state.source.token,
            newBranch: state.source.newBranch,
            prebuilt: state.source.prebuilt,
          },
        }
      : {}),
    ...(state.snapshotId ? { restoreSnapshotId: state.snapshotId } : {}),
    env: options?.env,
    githubToken: options?.githubToken,
    gitUser: options?.gitUser,
    hooks: options?.hooks,
    ...(options?.timeout !== undefined && { timeout: options.timeout }),
    ...(options?.ports && { ports: options.ports }),
    ...(options?.baseSnapshotId && {
      baseSnapshotId: options.baseSnapshotId,
    }),
    ...(options?.persistent !== undefined && {
      persistent: options.persistent,
    }),
    ...(options?.snapshotExpiration !== undefined && {
      snapshotExpiration: options.snapshotExpiration,
    }),
    ...(options?.skipGitWorkspaceBootstrap && {
      skipGitWorkspaceBootstrap: true,
    }),
  };
}
