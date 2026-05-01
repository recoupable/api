import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const creditsGetQuerySchema = z.object({
  accountId: z.string().min(1, "accountId is required"),
});

export type CreditsGetQuery = z.infer<typeof creditsGetQuerySchema>;

export function validateCreditsGetQuery(
  searchParams: URLSearchParams,
): NextResponse | CreditsGetQuery {
  const accountId = searchParams.get("accountId") ?? "";
  const result = creditsGetQuerySchema.safeParse({ accountId });
  if (!result.success) {
    const first = result.error.issues[0];
    return NextResponse.json(
      { message: first.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return result.data;
}
