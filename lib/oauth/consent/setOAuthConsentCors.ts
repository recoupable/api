import type { IncomingMessage, ServerResponse } from "node:http";

/** Replace broad API CORS with the single credentialed consent origin. */
export function setOAuthConsentCors(req: IncomingMessage, res: ServerResponse, origin: string) {
  res.removeHeader("Access-Control-Allow-Origin");
  res.setHeader("Vary", "Origin");
  if (req.headers.origin !== origin) {
    return !req.headers.origin && req.method === "GET" && !req.headers.authorization;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return true;
}
