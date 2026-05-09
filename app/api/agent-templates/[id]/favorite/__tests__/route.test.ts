import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { toggleAgentTemplateFavoriteHandler } from "@/lib/agent_templates/toggleAgentTemplateFavoriteHandler";

const { PUT, OPTIONS } = await import("../route");

const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

describe("app/api/agent-templates/[id]/favorite/route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(getCorsHeaders).toHaveBeenCalled();
  });

  it("PUT delegates to toggleAgentTemplateFavoriteHandler", async () => {
    const handlerRes = NextResponse.json({ status: "success" });
    vi.mocked(toggleAgentTemplateFavoriteHandler).mockResolvedValue(handlerRes);

    const req = new NextRequest(`http://localhost/api/agent-templates/${TEMPLATE_ID}/favorite`, {
      method: "PUT",
    });
    const params = Promise.resolve({ id: TEMPLATE_ID });
    const res = await PUT(req, { params });

    expect(toggleAgentTemplateFavoriteHandler).toHaveBeenCalledWith(req, params);
    expect(res).toBe(handlerRes);
  });
});
