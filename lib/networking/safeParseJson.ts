import { NextRequest } from "next/server";

/**
 * Safely parses JSON from a request body.
 * Returns an empty object if the body is empty or invalid JSON.
 *
 * @param request - The NextRequest object
 * @returns The parsed JSON body or an empty object
 */
export async function safeParseJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
