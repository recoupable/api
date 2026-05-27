import * as path from "path";
import { isPosixSandboxPath } from "@/lib/sandbox/isPosixSandboxPath";
import { toPosixSegment } from "@/lib/sandbox/toPosixSegment";

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
