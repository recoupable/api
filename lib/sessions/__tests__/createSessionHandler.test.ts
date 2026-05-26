import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

import { validateCreateSessionBody } from "@/lib/sessions/validateCreateSessionBody";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { createSessionHandler } from "@/lib/sessions/createSessionHandler";
import { makeCreateSessionReq } from "@/lib/sessions/__tests__/makeCreateSessionReq";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sessions/validateCreateSessionBody", () => ({
  validateCreateSessionBody: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/insertSession", () => ({ insertSession: vi.fn() }));
vi.mock("@/lib/supabase/sessions/deleteSessionById", () => ({ deleteSessionById: vi.fn() }));
vi.mock("@/lib/supabase/chats/insertChat", () => ({ insertChat: vi.fn() }));
vi.mock("@/lib/sessions/resolveSessionTitle", () => ({
  resolveSessionTitle: vi.fn(async () => "Anchorage"),
}));
vi.mock("@/lib/recoupable/ensurePersonalRepo", () => ({
  ensurePersonalRepo: vi.fn(async () => "https://github.com/recoupable/acc-uuid-1"),
}));

describe("createSessionHandler — short-circuits on validation failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the NextResponse from validateCreateSessionBody as-is", async () => {
    const failure = NextResponse.json({ status: "error", error: "bad" }, { status: 401 });
    vi.mocked(validateCreateSessionBody).mockResolvedValue(failure);

    const res = await createSessionHandler(makeCreateSessionReq({}));
    expect(res).toBe(failure);
    expect(insertSession).not.toHaveBeenCalled();
  });

  it("returns 400 when validateCreateSessionBody rejects with 400", async () => {
    vi.mocked(validateCreateSessionBody).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Invalid sandbox type" }, { status: 400 }),
    );

    const res = await createSessionHandler(makeCreateSessionReq({ sandboxType: "wrong" }));
    expect(res.status).toBe(400);
    expect(insertSession).not.toHaveBeenCalled();
  });
});
