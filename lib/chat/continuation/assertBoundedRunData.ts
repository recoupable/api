import { ContinuationError } from "./ContinuationError";
/** Bound serialized World input before hydration, including encrypted binary envelopes. */
export function assertBoundedRunData(value: unknown) {
  let bytes = 0;
  let values = 0;
  const ancestors = new Set<object>();
  function walk(item: unknown, depth: number) {
    if (++values > 250_000 || depth > 64) throw new Error();
    if (typeof item === "string") bytes += Buffer.byteLength(item, "utf8");
    else if (item instanceof Uint8Array) bytes += item.byteLength;
    else if (item && typeof item === "object") {
      if (ancestors.has(item)) throw new Error();
      ancestors.add(item);
      const keys = Reflect.ownKeys(item);
      if (keys.length > 250_000 - values) throw new Error();
      for (const key of keys) {
        if (typeof key !== "string") throw new Error();
        bytes += Buffer.byteLength(key, "utf8") + 4;
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (!("value" in descriptor)) throw new Error();
        walk(descriptor.value, depth + 1);
      }
      ancestors.delete(item);
    } else bytes += 8;
    if (bytes > 16_777_216) throw new Error();
  }
  try {
    walk(value, 0);
  } catch {
    throw new ContinuationError("stream_continuation_evidence_unavailable");
  }
}
