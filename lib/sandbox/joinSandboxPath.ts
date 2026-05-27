import * as path from "path";
import { isPosixSandboxPath } from "@/lib/sandbox/isPosixSandboxPath";
import { toPosixSegment } from "@/lib/sandbox/toPosixSegment";

/** Join path segments, preserving POSIX semantics for sandbox paths. */
export function joinSandboxPath(...segments: string[]): string {
  if (segments.some(isPosixSandboxPath)) {
    return path.posix.join(...segments.map(toPosixSegment));
  }
  return path.join(...segments);
}
