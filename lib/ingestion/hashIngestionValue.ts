import { createHash } from "node:crypto";

/** Stable fingerprint; object key order does not change request identity. */
export function hashIngestionValue(value: unknown): string {
  const canonical = (v: unknown): string => {
    if (v instanceof Uint8Array) return Buffer.from(v).toString("base64");
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    if (v !== null && typeof v === "object")
      return `{${Object.keys(v)
        .sort()
        .map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
        .join(",")}}`;
    return JSON.stringify(v) ?? "null";
  };
  return createHash("sha256").update(canonical(value)).digest("hex");
}
