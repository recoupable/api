import * as path from "path";
import { isPosixSandboxPath } from "@/lib/sandbox/isPosixSandboxPath";
import { toPosixSegment } from "@/lib/sandbox/toPosixSegment";

export function dirnameSandboxPath(filePath: string, workingDirectory: string): string {
  if (isPosixSandboxPath(workingDirectory) || isPosixSandboxPath(filePath)) {
    return path.posix.dirname(toPosixSegment(filePath));
  }
  return path.dirname(filePath);
}
