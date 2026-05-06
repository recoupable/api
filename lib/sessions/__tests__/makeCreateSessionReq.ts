import { NextRequest } from "next/server";

/**
 * Builds a NextRequest pointing at `/api/sessions` with a JSON body
 * and the standard test API key already attached.
 *
 * @param body - The body to send (object literal or raw string).
 */
export function makeCreateSessionReq(body: unknown): NextRequest {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-api-key": "key_test",
  });
  return new NextRequest("http://localhost/api/sessions", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
