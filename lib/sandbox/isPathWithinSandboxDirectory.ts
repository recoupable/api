import * as path from "path";
import { isPosixSandboxPath } from "@/lib/sandbox/isPosixSandboxPath";
import { toPosixSegment } from "@/lib/sandbox/toPosixSegment";

export function isPathWithinSandboxDirectory(filePath: string, directory: string): boolean {
  if (isPosixSandboxPath(directory)) {
    const resolvedPath = path.posix.normalize(toPosixSegment(filePath));
    const resolvedDir = path.posix.normalize(directory);
    // Avoid the "//child" false-negative when resolvedDir is the root "/".
    const dirPrefix = resolvedDir.endsWith("/") ? resolvedDir : `${resolvedDir}/`;
    return resolvedPath === resolvedDir || resolvedPath.startsWith(dirPrefix);
  }

  // Windows paths are case-insensitive; lowercase both before comparing.
  const resolvedPath = path.resolve(filePath).toLowerCase();
  const resolvedDir = path.resolve(directory).toLowerCase();
  return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
}
