import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { buildLifecycle } from "@/lib/sandbox/buildLifecycle";
import type { Tables } from "@/types/database.types";

/**
 * Builds the `status: "no_sandbox"` response shared by sandbox lifecycle
 * endpoints (currently `/reconnect`). Used when the session row lacks
 * runtime metadata — there is no live sandbox to probe, so report that
 * directly along with whether a snapshot exists for resume affordances.
 *
 * @param row - The `sessions` row.
 * @returns A 200 NextResponse with `{status, hasSnapshot, lifecycle}`.
 */
export function noSandboxResponse(row: Tables<"sessions">): NextResponse {
  return NextResponse.json(
    {
      status: "no_sandbox" as const,
      hasSnapshot: !!row.snapshot_url,
      lifecycle: buildLifecycle(row),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
