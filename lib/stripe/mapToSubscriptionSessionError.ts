import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export function mapToSubscriptionSessionErrorResponse(res: NextResponse): Promise<NextResponse> {
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
      return NextResponse.json(
        { error: message },
        { status: res.status, headers: getCorsHeaders() },
      );
    });
}
