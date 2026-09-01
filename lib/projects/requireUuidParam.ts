import type { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * Rejects a path segment that is not a UUID, before auth and before any
 * database call.
 *
 * Every id in these routes is a UUID column, and an unguarded segment reaches
 * Postgres as `invalid input syntax for type uuid`, throws, and surfaces as a
 * 500 — a mistyped link answering as a server fault. A 400 discloses nothing:
 * it says the id is not an id, not whether one by that name exists, so the
 * 404-never-403 property these routes rely on is untouched.
 *
 * @param value - The raw path segment.
 * @param name - The parameter name, as it appears in the message.
 * @returns The 400 response to return, or null when the value is a UUID.
 */
export function requireUuidParam(value: string, name: string): NextResponse | null {
  if (z.string().uuid().safeParse(value).success) return null;
  return errorResponse(`${name} must be a valid UUID`, 400);
}
