import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
import { validateOriginalIntakeQuery } from "@/lib/context/originals/validateOriginalIntakeQuery";
import { readBoundedOriginalStream } from "@/lib/context/originals/readBoundedOriginalStream";
import { storeContextOriginal } from "@/lib/context/originals/storeContextOriginal";
import { reconcileContextOriginal } from "@/lib/context/originals/reconcileContextOriginal";
import { ContextOriginalNeedsReconciliation } from "@/lib/context/originals/ContextOriginalNeedsReconciliation";
const headers = { "Cache-Control": "private, no-store" };
/**
 * Disabled pilot for raw private PDF/CSV bytes and explicit reconciliation.
 *
 * @param request - Authenticated request with strict query metadata and raw bytes.
 * @returns Private receipt or redacted error; never a storage capability.
 */
export async function POST(request: NextRequest) {
  const reply = (error: string, status: number) =>
    NextResponse.json({ status: "error", error }, { status, headers });
  if (process.env.CONTEXT_ORIGINAL_INTAKE_ENABLED !== "true")
    return reply("Original intake unavailable", 503);
  let parsed: ReturnType<typeof validateOriginalIntakeQuery>;
  try {
    parsed = validateOriginalIntakeQuery(
      request.nextUrl.searchParams,
      request.headers.get("content-type"),
    );
  } catch {
    return reply("Invalid original metadata", 400);
  }
  const auth = await validateAuthContext(request, { organizationId: parsed.organizationId });
  if (auth instanceof NextResponse) {
    auth.headers.set("Cache-Control", "private, no-store");
    return auth;
  }
  const owner = auth.orgId ?? auth.accountId;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  try {
    const retry = await consumeOAuthRateLimit(hash("context-original-intake-v1"), [
      { key: hash("all"), limit: 8 },
      { key: hash("actor:" + auth.accountId.toLowerCase()), limit: 1 },
    ]);
    if (retry)
      return NextResponse.json(
        { status: "error", error: "Original intake throttled" },
        { status: 429, headers: { ...headers, "Retry-After": String(retry) } },
      );
  } catch {
    return reply("Original intake throttling unavailable", 503);
  }
  let file: Blob;
  try {
    if (!request.body) throw new Error();
    file = await readBoundedOriginalStream(request.body, {
      maxBytes: 4194304,
      timeoutMs: 30000,
      signal: request.signal,
    });
    if (request.signal.aborted) throw new Error();
  } catch {
    return reply("Original body unavailable or exceeds intake limits", 400);
  }
  try {
    const input = {
      sourceId: parsed.sourceId,
      idempotencyKey: parsed.idempotencyKey,
      mediaType: parsed.mediaType,
    };
    const receipt =
      parsed.mode === "reconcile"
        ? await reconcileContextOriginal(auth.accountId, owner, input, file.stream())
        : await storeContextOriginal(auth.accountId, owner, input, file.stream(), request.signal);
    return NextResponse.json(receipt, { headers });
  } catch (error) {
    // Report a bounded category, never customer paths, bytes, IDs or backend causes.
    console.error("Context original operation failed", {
      outcome:
        error instanceof ContextOriginalNeedsReconciliation
          ? "needs_reconciliation"
          : "unavailable",
    });
    if (error instanceof ContextOriginalNeedsReconciliation)
      return NextResponse.json(
        { status: "needs_reconciliation", error: "Original outcome requires reconciliation" },
        { status: 409, headers },
      );
    return reply("Original intake unavailable", 503);
  }
}
