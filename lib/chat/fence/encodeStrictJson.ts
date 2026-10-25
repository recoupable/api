/** Encode strict JSON with UTF-16 sorted keys, without invoking getters or toJSON. */
export function encodeStrictJson(input: unknown): string {
  const ancestors = new Set<object>();
  function encode(value: unknown, depth: number): string {
    if (depth > 100) throw new Error("JSON nesting exceeds 100 levels");
    if (value === null || typeof value === "boolean" || typeof value === "string") {
      return JSON.stringify(value);
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
        throw new Error("JSON requires finite numbers and safe integers");
      }
      return JSON.stringify(value);
    }
    if (typeof value !== "object") throw new Error("Unsupported JSON value");
    if (ancestors.has(value)) throw new Error("Cyclic JSON value");
    if (
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      throw new Error("JSON requires plain objects");
    }
    ancestors.add(value);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Reflect.ownKeys(value).some(key => typeof key !== "string"))
        throw new Error("Symbol JSON key");
      for (const [key, descriptor] of Object.entries(descriptors)) {
        // Zod drops this own key while cloning JSON; reject rather than hash/write altered data.
        if (key === "__proto__") throw new Error("Unsupported JSON key: __proto__");
        if (Array.isArray(value) && key === "length") continue;
        if (!("value" in descriptor) || !descriptor.enumerable)
          throw new Error("Unsupported JSON property");
      }
      if (Array.isArray(value)) {
        if (Object.keys(descriptors).length !== value.length + 1)
          throw new Error("Sparse or extended JSON array");
        const items: string[] = [];
        for (let i = 0; i < value.length; i++) {
          if (!descriptors[String(i)]) throw new Error("Sparse JSON array");
          items.push(encode(descriptors[String(i)].value, depth + 1));
        }
        return `[${items.join(",")}]`;
      }
      // Serialize keys directly: JSON.stringify(object) reorders integer-like keys.
      return `{${Object.keys(descriptors)
        .sort()
        .map(key => `${JSON.stringify(key)}:${encode(descriptors[key].value, depth + 1)}`)
        .join(",")}}`;
    } finally {
      ancestors.delete(value);
    }
  }
  return encode(input, 0);
}
