import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
import { getOriginalIntakeHeaders } from "./getOriginalIntakeHeaders";
import { validateOriginalDeliveryQuery } from "./validateOriginalDeliveryQuery";
import { readRetainedContextOriginal } from "./readRetainedContextOriginal";
/** Disabled private attachment delivery; paths and bearer capabilities never leave the reader. */
export async function handleOriginalDelivery(request: NextRequest) {
  const headers = getOriginalIntakeHeaders();
  const unavailable = (status = 503) =>
    NextResponse.json(
      { status: "error", error: "Original delivery unavailable" },
      { status, headers },
    );
  if (process.env.CONTEXT_ORIGINAL_INTAKE_ENABLED !== "true") return unavailable();
  let query: ReturnType<typeof validateOriginalDeliveryQuery>;
  try {
    query = validateOriginalDeliveryQuery(request.nextUrl.searchParams);
    if (request.headers.has("range")) throw new Error();
  } catch {
    return unavailable(400);
  }
  let auth: Awaited<ReturnType<typeof validateAuthContext>>;
  try {
    auth = await validateAuthContext(request, { organizationId: query.organizationId });
  } catch {
    console.error("Context original delivery authentication failed", { outcome: "unavailable" });
    return unavailable();
  }
  if (auth instanceof NextResponse) {
    for (const [name, value] of Object.entries(headers)) auth.headers.set(name, value);
    return auth;
  }
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  try {
    const retry = await consumeOAuthRateLimit(hash("context-original-intake-v1"), [
      { key: hash("all"), limit: 8 },
      { key: hash("actor:" + auth.accountId.toLowerCase()), limit: 1 },
    ]);
    if (retry)
      return NextResponse.json(
        { status: "error", error: "Original delivery throttled" },
        { status: 429, headers: { ...headers, "Retry-After": String(retry) } },
      );
  } catch {
    return unavailable();
  }
  try {
    if (request.signal.aborted) throw new Error();
    const { receipt, file } = await readRetainedContextOriginal(
      auth.accountId,
      auth.orgId ?? auth.accountId,
      query.receiptId,
      4194304,
    );
    if (
      request.signal.aborted ||
      file.size > 4194304 ||
      file.size !== receipt.bytes ||
      !["text/csv", "application/pdf"].includes(receipt.media_type)
    )
      throw new Error();
    const extension = receipt.media_type === "application/pdf" ? "pdf" : "csv";
    return new NextResponse(file, {
      headers: {
        ...headers,
        "Content-Type": receipt.media_type,
        "Content-Length": String(file.size),
        "Content-Disposition": `attachment; filename="original.${extension}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.error("Context original delivery failed", { outcome: "unavailable" });
    return unavailable();
  }
}
