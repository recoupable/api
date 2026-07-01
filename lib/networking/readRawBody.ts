import { NextRequest } from "next/server";

/**
 * Reads a request body once, as text — the single source for both JSON parsing
 * and raw-body logging. Returns an empty string if the body can't be read, so
 * callers never throw on a missing/unreadable body.
 *
 * @param request - The NextRequest object
 * @returns The body as a string, or "" when it can't be read
 */
export async function readRawBody(request: NextRequest): Promise<string> {
  try {
    return await request.text();
  } catch {
    return "";
  }
}
