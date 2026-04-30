import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const INTERNAL_ERROR_MESSAGE = "Internal server error";

export function mapToSubscriptionSessionError(res: NextResponse): Promise<NextResponse> {
  const status = res.status;
  if (status >= 500) {
    return Promise.resolve(
      NextResponse.json({ error: INTERNAL_ERROR_MESSAGE }, { status, headers: getCorsHeaders() }),
    );
  }

  return res
    .clone()
    .json()
    .then((data: unknown) => {
      let message = "Unauthorized";
      if (data && typeof data === "object") {
        const o = data as Record<string, unknown>;
        if (typeof o.error === "string") message = o.error;
        else if (typeof o.message === "string") message = o.message;
      }
      return NextResponse.json({ error: message }, { status, headers: getCorsHeaders() });
    });
}
