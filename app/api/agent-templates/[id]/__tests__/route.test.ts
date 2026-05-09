import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { updateAgentTemplateHandler } from "@/lib/agent_templates/updateAgentTemplateHandler";
import { deleteAgentTemplateHandler } from "@/lib/agent_templates/deleteAgentTemplateHandler";

const { PATCH, DELETE, OPTIONS } = await import("../route");

const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

describe("app/api/agent-templates/[id]/route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(getCorsHeaders).toHaveBeenCalled();
  });

  it("PATCH delegates to updateAgentTemplateHandler with the path params", async () => {
    const handlerRes = NextResponse.json({ status: "success" });
    vi.mocked(updateAgentTemplateHandler).mockResolvedValue(handlerRes);

    const req = new NextRequest(`http://localhost/api/agent-templates/${TEMPLATE_ID}`, {
      method: "PATCH",
    });
    const params = Promise.resolve({ id: TEMPLATE_ID });
    const res = await PATCH(req, { params });

    expect(updateAgentTemplateHandler).toHaveBeenCalledWith(req, params);
    expect(res).toBe(handlerRes);
  });

  it("DELETE delegates to deleteAgentTemplateHandler with the path params", async () => {
    const handlerRes = NextResponse.json({ status: "success" });
    vi.mocked(deleteAgentTemplateHandler).mockResolvedValue(handlerRes);

    const req = new NextRequest(`http://localhost/api/agent-templates/${TEMPLATE_ID}`, {
      method: "DELETE",
    });
    const params = Promise.resolve({ id: TEMPLATE_ID });
    const res = await DELETE(req, { params });

    expect(deleteAgentTemplateHandler).toHaveBeenCalledWith(req, params);
    expect(res).toBe(handlerRes);
  });
});
