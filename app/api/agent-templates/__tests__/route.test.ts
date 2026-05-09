import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { listAgentTemplatesHandler } from "@/lib/agent_templates/listAgentTemplatesHandler";
import { createAgentTemplateHandler } from "@/lib/agent_templates/createAgentTemplateHandler";

const { GET, POST, OPTIONS } = await import("../route");

describe("app/api/agent-templates/route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(getCorsHeaders).toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("GET delegates to listAgentTemplatesHandler", async () => {
    const handlerRes = NextResponse.json({ status: "success", templates: [] });
    vi.mocked(listAgentTemplatesHandler).mockResolvedValue(handlerRes);

    const req = new NextRequest("http://localhost/api/agent-templates");
    const res = await GET(req);
    expect(listAgentTemplatesHandler).toHaveBeenCalledWith(req);
    expect(res).toBe(handlerRes);
  });

  it("POST delegates to createAgentTemplateHandler", async () => {
    const handlerRes = NextResponse.json({ status: "success" }, { status: 201 });
    vi.mocked(createAgentTemplateHandler).mockResolvedValue(handlerRes);

    const req = new NextRequest("http://localhost/api/agent-templates", { method: "POST" });
    const res = await POST(req);
    expect(createAgentTemplateHandler).toHaveBeenCalledWith(req);
    expect(res).toBe(handlerRes);
  });
});
