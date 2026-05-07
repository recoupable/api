export interface SandboxSource {
  repo: string;
  branch?: string;
}

/**
 * Builds the `source` shape that `connectSandbox` consumes.
 *
 * @param input - The repo URL and optional branch to check out.
 * @returns A `{repo, branch?}` source descriptor.
 */
export function buildSource({
  repoUrl,
  branch,
}: {
  repoUrl: string;
  branch?: string;
}): SandboxSource {
  return branch ? { repo: repoUrl, branch } : { repo: repoUrl };
}
