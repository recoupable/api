import { createHash } from "node:crypto";
export function hashFanValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
