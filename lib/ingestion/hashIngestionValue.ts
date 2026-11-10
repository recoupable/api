import { createHash } from "node:crypto";

/** Stable fingerprint; object key order does not change request identity. */
export function hashIngestionValue(value: unknown): string {
  const canonical = (v: unknown): string => {
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++)
        if (!Object.hasOwn(v, i)) throw new Error("Unsupported fingerprint value");
      return `[${v.map(canonical).join(",")}]`;
    }
    if (v !== null && typeof v === "object") {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(v)))
        throw new Error("Unsupported fingerprint value");
      return `{${Object.keys(v)
        .sort()
        .map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
        .join(",")}}`;
    }
    if (
      v === null ||
      typeof v === "string" ||
      typeof v === "boolean" ||
      (typeof v === "number" && Number.isFinite(v))
    )
      return JSON.stringify(v);
    throw new Error("Unsupported fingerprint value");
  };
  return createHash("sha256").update(canonical(value)).digest("hex");
}
