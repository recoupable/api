import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Reshapes an auth failure into the documented `ClaimSubscriptionErrorResponse`
 * (`{ status: "error", error }`): the api-key path answers with `message`
 * rather than `error`, and the contract promises one shape.
 */
export async function mapToClaimError(res: NextResponse): Promise<NextResponse> {
  const data = (await res
    .clone()
    .json()
    .catch(() => ({}))) as Record<string, unknown>;
  const error =
    typeof data.error === "string"
      ? data.error
      : typeof data.message === "string"
        ? data.message
        : "Unauthorized";
  return NextResponse.json(
    { status: "error", error },
    { status: res.status, headers: getCorsHeaders() },
  );
}
