import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const subscriptionStatusQuerySchema = z.object({
  accountId: z.string().min(1, "accountId is required"),
});

export type SubscriptionStatusQuery = z.infer<typeof subscriptionStatusQuerySchema>;

export function validateSubscriptionStatusQuery(
  searchParams: URLSearchParams,
): NextResponse | SubscriptionStatusQuery {
  const accountId = searchParams.get("accountId") ?? "";
  const result = subscriptionStatusQuerySchema.safeParse({ accountId });
  if (!result.success) {
    const first = result.error.issues[0];
    return NextResponse.json(
      { message: first.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return result.data;
}
