import { z } from "zod";
import { INGESTION_MAX_BYTES } from "./const";

const sourceSchema = z.strictObject({
  id: z.string().min(1).max(128),
  scope: z.string().regex(/^(account|organization)\/[a-f0-9-]{36}$/),
  url: z.url().refine(s => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }),
  token_env: z
    .string()
    .regex(/^INGESTION_SOURCE_[A-Z0-9_]+$/)
    .optional(),
});

/** Acquire one bounded JSON snapshot from an operator-configured HTTPS connector. No caller URLs. */
export async function acquireIngestionSource(scope: string, connectorId: string) {
  const sources = (() => {
    try {
      return z.array(sourceSchema).parse(JSON.parse(process.env.INGESTION_SOURCES_JSON ?? "[]"));
    } catch {
      throw new Error("Source connector configuration invalid");
    }
  })();
  const matches = sources.filter(s => s.scope === scope && s.id === connectorId);
  if (matches.length !== 1) throw new Error("Source connector unavailable");
  const source = matches[0];
  const token = source.token_env ? process.env[source.token_env] : undefined;
  if (source.token_env && !token) throw new Error("Source connector unavailable");
  const response = await fetch(source.url, {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error("Source acquisition failed");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > INGESTION_MAX_BYTES) throw new Error("Source size limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return { bytes: Buffer.concat(chunks), format: "json" as const, filename: `${connectorId}.json` };
}
