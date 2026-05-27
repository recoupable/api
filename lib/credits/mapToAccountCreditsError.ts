import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const INTERNAL_ERROR_MESSAGE = "Internal server error";

/**
 * Normalizes an upstream validation/auth NextResponse into the `{ error }` body
 * documented for `GET /api/accounts/{id}/credits`. Accepts the `{ message }` or
 * `{ error }` shapes that `validateAuthContext` and its helpers produce, and
 * masks any 5xx into a generic internal-error message.
 */
export async function mapToAccountCreditsError(res: NextResponse): Promise<NextResponse> {
  const status = res.status;
  if (status >= 500) {
    return NextResponse.json(
      { error: INTERNAL_ERROR_MESSAGE },
      { status, headers: getCorsHeaders() },
    );
  }

  const data: unknown = await res.clone().json();
  let message = "Unauthorized";
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.error === "string") message = o.error;
    else if (typeof o.message === "string") message = o.message;
  }
  return NextResponse.json({ error: message }, { status, headers: getCorsHeaders() });
}
