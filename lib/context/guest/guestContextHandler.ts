import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchGuestContext } from "./dispatchGuestContext";
import { processGuestContext } from "./processGuestContext";
const cookieName = "recoup_context_guest";
/** Same-origin funnel endpoint. Guest cookies never grant account access. */
export async function guestContextHandler(request: NextRequest, claim = false) {
  if (process.env.CONTEXT_GUEST_ENABLED !== "true")
    return NextResponse.json({ error: "Guest context is not enabled" }, { status: 503 });
  const origin = request.headers.get("origin");
  const allowed = (process.env.CONTEXT_GUEST_ORIGINS || request.nextUrl.origin)
    .split(",")
    .map(s => s.trim());
  if (request.method === "POST" && (!origin || !allowed.includes(origin)))
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  const existing = request.cookies.get(cookieName)?.value;
  let token =
    existing || (request.method === "POST" && !claim ? randomBytes(32).toString("hex") : null);
  if (!token) return NextResponse.json({ error: "Guest session required" }, { status: 401 });
  const body =
    request.method === "GET" ? { action: "read" } : await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  if (claim ? body.action !== "claim" : !["start", "read"].includes(body.action))
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  let account: string | null = null;
  if (claim) {
    const auth = await validateAuthContext(request, { organizationId: body.organization_id });
    if (auth instanceof NextResponse) return auth;
    account = auth.accountId;
  }
  try {
    // A claimed or expired cookie remains useful for claim retries, but not for a new URL.
    if (existing && body.action === "start") {
      const active = await callContextRpc("read_context_guest", {
        p_hash: createHash("sha256").update(existing).digest("hex"),
      });
      if (!active) token = randomBytes(32).toString("hex");
    }
    const result = await processGuestContext(token, body, account, {
      rpc: callContextRpc,
      dispatch: dispatchGuestContext,
      dailyLimit: 100,
    });
    const response = NextResponse.json(result, {
      status: body.action === "start" ? 202 : 200,
      headers: { "Cache-Control": "no-store" },
    });
    // Retain the cookie after claim for idempotent retry, but guest reads are revoked in SQL.
    if (token !== existing)
      response.cookies.set(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/context/guest",
        maxAge: 7 * 86400,
      });
    return response;
  } catch {
    const response = NextResponse.json(
      {
        error:
          "Guest operation unavailable. Retry the same input and session; signing in is required to claim work.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
    // Preserve the capability even if workflow dispatch failed after the database save.
    if (token !== existing)
      response.cookies.set(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/context/guest",
        maxAge: 7 * 86400,
      });
    return response;
  }
}
