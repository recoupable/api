import { NextResponse } from "next/server";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";

/**
 * Parse the optional `startIndex` query param of
 * `GET /api/chat/{chatId}/stream`.
 *
 * Documented as `integer, minimum 0` — the zero-based index of the first
 * chunk to return, so a reconnecting client resumes where it left off
 * instead of replaying the turn. Absent means "from the beginning", which
 * is what a fresh reader (page load, or first watch of a headless run)
 * wants.
 *
 * Negative values are rejected even though the SDK accepts them: it reads
 * them relative to the end of a live stream, which resolves to a different
 * absolute position on every call and so cannot give a client an exact,
 * gap-free resume.
 *
 * @param url - The request URL carrying the query string.
 * @returns The parsed index, `undefined` when absent, or a 400 response.
 */
export function parseStreamStartIndex(url: URL): number | undefined | NextResponse {
  const raw = url.searchParams.get("startIndex");
  if (raw === null) return undefined;

  const parsed = Number(raw);
  if (raw.trim() === "" || !Number.isInteger(parsed) || parsed < 0) {
    return validationErrorResponse("startIndex must be a non-negative integer", ["startIndex"]);
  }

  return parsed;
}
