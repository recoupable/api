import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { hasProjectAccess } from "@/lib/projects/hasProjectAccess";

/**
 * The gate on every `/api/projects` endpoint (app#2048).
 *
 * Resolves the caller with `validateAuthContext`, which accepts either an
 * `x-api-key` header or an `Authorization: Bearer` token — a Recoup API key or
 * a Privy access token — so the browser and a CLI share one credential path.
 * Then requires a collaborator row on the project. No row is a **404, never a
 * 403**: a 403 tells the caller the project id is real, and these ids are
 * handed out in links.
 *
 * No `account_id` override is accepted. Access here is per project, so a
 * caller acting for another account still needs that account's collaborator
 * row, which the row itself already expresses.
 *
 * @returns The authenticated account id, or the response to return instead.
 */
export async function requireProjectAccess(
  request: NextRequest,
  projectId: string,
): Promise<string | NextResponse> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;

  const { accountId } = auth;
  if (!(await hasProjectAccess(projectId, accountId))) {
    return errorResponse("Project not found", 404);
  }

  return accountId;
}
