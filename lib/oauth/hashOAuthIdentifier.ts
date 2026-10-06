import { createHmac } from "node:crypto";

/** Stable keyed lookup shared by provider persistence and owner-scoped connection management. */
export function hashOAuthIdentifier(namespace: string, indexKey: Buffer, value: string) {
  return createHmac("sha256", indexKey)
    .update(JSON.stringify([namespace, value]))
    .digest("hex");
}
