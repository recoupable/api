import { encodeStrictJson } from "../fence/encodeStrictJson";
import { ContinuationError } from "./ContinuationError";
/** Inspect descriptors before serialization: never invoke getters or toJSON. */
export function encodeBoundedContinuationValue(
  value: unknown,
  options: {
    maxBytes?: number;
    maxDepth?: number;
    maxValues?: number;
    rejectMarker?: boolean;
    omitUndefined?: boolean;
  } = {},
) {
  let remaining = options.maxValues ?? 50_000;
  const ancestors = new Set<object>();
  function walk(item: unknown, depth: number) {
    if (--remaining < 0 || depth > (options.maxDepth ?? 32)) throw new Error("bound");
    if (!item || typeof item !== "object") return;
    if (ancestors.has(item)) throw new Error("cycle");
    ancestors.add(item);
    const keys = Reflect.ownKeys(item);
    if (keys.length > remaining + 1) throw new Error("bound");
    for (const key of keys) {
      if (Array.isArray(item) && key === "length") continue;
      if (options.rejectMarker && key === "recoupStream") throw new Error("reserved");
      const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
      if (!("value" in descriptor)) throw new Error("accessor");
      walk(descriptor.value, depth + 1);
    }
    ancestors.delete(item);
  }
  try {
    walk(value, 0);
    return encodeStrictJson(value, {
      maxBytes: options.maxBytes ?? 1_048_576,
      omitUndefinedObjectProperties: options.omitUndefined,
    });
  } catch {
    throw new ContinuationError("stream_continuation_invalid");
  }
}
