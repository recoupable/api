/** Finite JSON extension values with bounded nesting; reject cycles and non-JSON runtime values. */
export function isCatalogJson(value: unknown): boolean {
  const ancestors = new Set<object>();
  const visit = (item: unknown, depth: number): boolean => {
    if (depth > 100) return false;
    if (item === null || typeof item === "string" || typeof item === "boolean") return true;
    if (typeof item === "number") return Number.isFinite(item);
    if (!item || typeof item !== "object" || ancestors.has(item)) return false;
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    )
      return false;
    ancestors.add(item);
    const valid = Object.values(item).every(child => visit(child, depth + 1));
    ancestors.delete(item);
    return valid;
  };
  return visit(value, 0);
}
