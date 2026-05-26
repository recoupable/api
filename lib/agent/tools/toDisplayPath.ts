import {
  isPathWithinSandboxDirectory,
  relativeSandboxPath,
  resolveSandboxPath,
} from "@/lib/sandbox/sandboxPaths";

/**
 * Convert an absolute (or relative-to-workingDirectory) path into a compact
 * model-friendly display path.
 *
 * Paths inside the working directory are returned relative (e.g.
 * `src/index.ts`) to avoid repeating long absolute prefixes in tool output.
 * Paths outside the working directory remain absolute for clarity and safety
 * (e.g. `/etc/hosts`). All separators are normalized to `/`.
 *
 * @param filePath - Absolute or workspace-relative file path.
 * @param workingDirectory - The sandbox's working directory (always absolute).
 */
export function toDisplayPath(filePath: string, workingDirectory: string): string {
  const absolutePath = resolveSandboxPath(workingDirectory, filePath);

  if (!isPathWithinSandboxDirectory(absolutePath, workingDirectory)) {
    return absolutePath.replace(/\\/g, "/");
  }

  const relativePath = relativeSandboxPath(workingDirectory, absolutePath);
  if (relativePath === "") return ".";

  return relativePath.replace(/\\/g, "/");
}
