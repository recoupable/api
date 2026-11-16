/** Encode strict JSON with UTF-16 sorted keys, without invoking getters or toJSON. */
export function encodeStrictJson(
  input: unknown,
  options: { omitUndefinedObjectProperties?: boolean; maxBytes?: number } = {},
): string {
  const ancestors = new Set<object>();
  let remaining = options.maxBytes ?? Infinity;
  if (options.maxBytes !== undefined && (!Number.isSafeInteger(remaining) || remaining < 0))
    throw new Error("Invalid JSON byte budget");
  function consume(bytes: number) {
    remaining -= bytes;
    if (remaining < 0) throw new Error("JSON exceeds byte budget");
  }
  function literal(text: string) {
    consume(Buffer.byteLength(text, "utf8"));
    return text;
  }
  function checkString(value: string): void {
    for (let i = 0; i < value.length; i++) {
      const unit = value.charCodeAt(i);
      if (unit === 0) throw new Error("NUL is not supported by JSONB storage");
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("Unpaired surrogate");
      } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new Error("Unpaired surrogate");
    }
  }
  function encode(value: unknown, depth: number): string {
    if (depth > 100) throw new Error("JSON nesting exceeds 100 levels");
    if (typeof value === "string") {
      if (Buffer.byteLength(value, "utf8") > remaining) throw new Error("JSON exceeds byte budget");
      checkString(value);
    }
    if (value === null || typeof value === "boolean" || typeof value === "string") {
      return literal(JSON.stringify(value));
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
        throw new Error("JSON requires finite numbers and safe integers");
      }
      return literal(JSON.stringify(value));
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
        checkString(key);
        // Zod drops this own key while cloning JSON; reject rather than hash/write altered data.
        if (key === "__proto__") throw new Error("Unsupported JSON key: __proto__");
        if (Array.isArray(value) && key === "length") continue;
        if (!("value" in descriptor) || !descriptor.enumerable)
          throw new Error("Unsupported JSON property");
      }
      if (Array.isArray(value)) {
        if (Object.keys(descriptors).length !== value.length + 1)
          throw new Error("Sparse or extended JSON array");
        consume(2 + Math.max(0, value.length - 1));
        const items: string[] = [];
        for (let i = 0; i < value.length; i++) {
          if (!descriptors[String(i)]) throw new Error("Sparse JSON array");
          items.push(encode(descriptors[String(i)].value, depth + 1));
        }
        return `[${items.join(",")}]`;
      }
      // Serialize keys directly: JSON.stringify(object) reorders integer-like keys.
      const keys = Object.keys(descriptors)
        .filter(
          key => !options.omitUndefinedObjectProperties || descriptors[key].value !== undefined,
        )
        .sort();
      consume(2 + Math.max(0, keys.length - 1) + keys.length);
      return `{${keys.map(key => `${literal(JSON.stringify(key))}:${encode(descriptors[key].value, depth + 1)}`).join(",")}}`;
    } finally {
      ancestors.delete(value);
    }
  }
  return encode(input, 0);
}
