import type { IncomingMessage } from "node:http";
import { validateOAuthConsentBody } from "./validateOAuthConsentBody";

/** Bound JSON parsing before attempting one-use approval consumption. */
export async function readOAuthConsentBody(req: IncomingMessage) {
  if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json")
    return { status: 415, error: "json_required" } as const;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 16384) return { status: 413, error: "body_too_large" } as const;
    chunks.push(Buffer.from(chunk));
  }
  return validateOAuthConsentBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}
