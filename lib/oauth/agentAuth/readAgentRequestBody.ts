import type { IncomingMessage } from "node:http";
import { AgentRegistrationError } from "./AgentRegistrationError";

/** Bound the raw body and preserve duplicate form fields for protocol validation. */
export async function readAgentRequestBody(
  req: IncomingMessage,
  contentType: string,
  limit: number,
) {
  if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== contentType)
    throw new AgentRegistrationError("invalid_request", 415);
  if (req.headers["content-encoding"] && req.headers["content-encoding"] !== "identity")
    throw new AgentRegistrationError("invalid_request", 415);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += Buffer.byteLength(chunk);
    if (size > limit) break;
    chunks.push(Buffer.from(chunk));
  }
  if (size > limit) {
    // The iterator must detach its readable listener before resume can drain the upload.
    req.resume();
    throw new AgentRegistrationError("invalid_request", 413);
  }
  return Buffer.concat(chunks).toString("utf8");
}
