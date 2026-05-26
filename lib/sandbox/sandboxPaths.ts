import * as path from "path";

/** Remote sandboxes use POSIX paths even when the API process runs on Windows. */
export function isPosixSandboxPath(directory: string): boolean {
  return directory.startsWith("/");
}

function toPosixSegment(segment: string): string {
  return segment.replace(/\\/g, "/");
}

/**
 * Resolve a workspace-relative or absolute path inside a sandbox working directory.
 */
export function resolveSandboxPath(workingDirectory: string, filePath: string): string {
  if (isPosixSandboxPath(workingDirectory)) {
    const normalized = toPosixSegment(filePath);
    if (normalized.startsWith("/")) {
      return path.posix.normalize(normalized);
    }
    return path.posix.resolve(workingDirectory, normalized);
  }

  return path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(workingDirectory, filePath);
}

/** Join path segments, preserving POSIX semantics for sandbox paths. */
export function joinSandboxPath(...segments: string[]): string {
  if (segments.some(isPosixSandboxPath)) {
    return path.posix.join(...segments.map(toPosixSegment));
  }
  return path.join(...segments);
}

export function dirnameSandboxPath(filePath: string, workingDirectory: string): string {
  if (isPosixSandboxPath(workingDirectory) || isPosixSandboxPath(filePath)) {
    return path.posix.dirname(toPosixSegment(filePath));
  }
  return path.dirname(filePath);
}

export function isPathWithinSandboxDirectory(filePath: string, directory: string): boolean {
  if (isPosixSandboxPath(directory)) {
    const resolvedPath = path.posix.normalize(toPosixSegment(filePath));
    const resolvedDir = path.posix.normalize(directory);
    return resolvedPath === resolvedDir || resolvedPath.startsWith(`${resolvedDir}/`);
  }

  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(directory);
  return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
}

export function relativeSandboxPath(from: string, to: string): string {
  if (isPosixSandboxPath(from)) {
    return path.posix.relative(from, toPosixSegment(to));
  }
  return path.relative(from, to);
}
