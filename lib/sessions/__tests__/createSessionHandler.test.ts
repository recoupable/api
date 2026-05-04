import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { createSessionHandler } from "@/lib/sessions/createSessionHandler";
import { makeCreateSessionReq } from "@/lib/sessions/__tests__/makeCreateSessionReq";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/sessions/insertSession", () => ({ insertSession: vi.fn() }));
vi.mock("@/lib/supabase/sessions/deleteSessionById", () => ({ deleteSessionById: vi.fn() }));
vi.mock("@/lib/supabase/chats/insertChat", () => ({ insertChat: vi.fn() }));

const okAuth = { accountId: "acc-uuid-1", orgId: null, authToken: "key_test" };

describe("createSessionHandler — auth & validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when validateAuthContext rejects", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "no auth" }, { status: 401 }),
    );
    const res = await createSessionHandler(makeCreateSessionReq({}));
    expect(res.status).toBe(401);
    expect(insertSession).not.toHaveBeenCalled();
  });

  it("returns 400 when sandboxType is not 'vercel'", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const res = await createSessionHandler(makeCreateSessionReq({ sandboxType: "wrong" }));
    expect(res.status).toBe(400);
    expect(insertSession).not.toHaveBeenCalled();
  });
});
