import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getAgentTemplatesHandler } from "@/lib/agent_templates/getAgentTemplatesHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getAgentTemplatesForAccount } from "@/lib/supabase/agent_templates/getAgentTemplatesForAccount";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));
vi.mock("@/lib/supabase/agent_templates/getAgentTemplatesForAccount", () => ({
  getAgentTemplatesForAccount: vi.fn(),
}));

const ACCOUNT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("getAgentTemplatesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      orgId: null,
      authToken: "token",
    });
  });

  it("returns the auth NextResponse when validation fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValueOnce(failure);

    const req = new NextRequest("http://localhost/api/agent-templates", { method: "GET" });
    const res = await getAgentTemplatesHandler(req);

    expect(res).toBe(failure);
  });

  it("returns 200 with the template list", async () => {
    const payload = [
      {
        id: "tpl-1",
        title: "t",
        description: "d",
        prompt: "p",
        tags: null,
        creator: ACCOUNT_ID,
        is_private: false,
        created_at: null,
        favorites_count: 0,
        updated_at: null,
        is_favourite: false,
        shared_emails: [],
      },
    ];
    vi.mocked(getAgentTemplatesForAccount).mockResolvedValue(payload);

    const req = new NextRequest("http://localhost/api/agent-templates", { method: "GET" });
    const res = await getAgentTemplatesHandler(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(payload);
    expect(getAgentTemplatesForAccount).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it("returns 500 when the data layer throws", async () => {
    vi.mocked(getAgentTemplatesForAccount).mockRejectedValue(new Error("db"));

    const req = new NextRequest("http://localhost/api/agent-templates", { method: "GET" });
    const res = await getAgentTemplatesHandler(req);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to fetch templates" });
  });
});
