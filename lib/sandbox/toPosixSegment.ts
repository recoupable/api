/** Normalize native path separators to POSIX forward slashes. */
export function toPosixSegment(segment: string): string {
  return segment.replace(/\\/g, "/");
}
