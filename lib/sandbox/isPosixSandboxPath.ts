/** Remote sandboxes use POSIX paths even when the API process runs on Windows. */
export function isPosixSandboxPath(directory: string): boolean {
  return directory.startsWith("/");
}
