import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST, OPTIONS } from "@/app/api/chat/route";
import { handleChatWorkflowStream } from "@/lib/chat/handleChatWorkflowStream";

vi.mock("@/lib/chat/handleChatWorkflowStream", () => ({
  handleChatWorkflowStream: vi.fn(async () => new Response("ok", { status: 200 })),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("POST /api/chat route shell", () => {
  it("delegates to handleChatWorkflowStream (canonical path; alias of /api/chat/workflow)", async () => {
    const req = new NextRequest("http://localhost/api/chat", { method: "POST" });
    const res = await POST(req);

    expect(handleChatWorkflowStream).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
  });

  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await OPTIONS();

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
