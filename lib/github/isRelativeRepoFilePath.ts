/** Reject paths whose URL normalization could escape the Contents endpoint. */
export function isRelativeRepoFilePath(path: string): boolean {
  try {
    encodeURIComponent(path);
    return (
      !/[\\\x00-\x1f\x7f]/.test(path) &&
      path.split("/").every(segment => segment !== "" && segment !== "." && segment !== "..")
    );
  } catch {
    return false;
  }
}
