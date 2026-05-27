import * as path from "path";
import { isPosixSandboxPath } from "@/lib/sandbox/isPosixSandboxPath";
import { toPosixSegment } from "@/lib/sandbox/toPosixSegment";

export function relativeSandboxPath(from: string, to: string): string {
  if (isPosixSandboxPath(from)) {
    return path.posix.relative(from, toPosixSegment(to));
  }
  return path.relative(from, to);
}
