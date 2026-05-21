import * as path from "path";

function isPathWithinDirectory(filePath: string, directory: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(directory);
  return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
}

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
  const absolutePath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(workingDirectory, filePath);

  if (!isPathWithinDirectory(absolutePath, workingDirectory)) {
    return absolutePath.replace(/\\/g, "/");
  }

  const relativePath = path.relative(workingDirectory, absolutePath);
  if (relativePath === "") return ".";

  return relativePath.replace(/\\/g, "/");
}
