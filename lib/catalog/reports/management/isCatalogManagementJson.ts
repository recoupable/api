/** Plain object/scalar subset used by this contract; reject lossy JSON before Zod clones it. */
export function isCatalogManagementJson(value: unknown): boolean {
  const ancestors = new Set<object>();
  const visit = (item: unknown, depth: number): boolean => {
    if (depth > 16) return false;
    if (item === null || typeof item === "boolean") return true;
    if (typeof item === "number") return Number.isFinite(item);
    // Unicode mode treats a valid surrogate pair as one code point, allowing normal Unicode.
    if (typeof item === "string") return !/[\u0000\uD800-\uDFFF]/u.test(item);
    if (typeof item !== "object" || Array.isArray(item) || ancestors.has(item)) return false;
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== Object.prototype && prototype !== null) return false;
    ancestors.add(item);
    const valid = Reflect.ownKeys(item).every(key => {
      if (typeof key !== "string" || !visit(key, depth + 1)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
      return descriptor.enumerable && "value" in descriptor && visit(descriptor.value, depth + 1);
    });
    ancestors.delete(item);
    return valid;
  };
  try {
    return visit(value, 0);
  } catch {
    return false;
  }
}
