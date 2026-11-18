export function isPackFenceError(error: unknown): boolean {
  return error instanceof Error && error.name === "PackFenceError";
}
