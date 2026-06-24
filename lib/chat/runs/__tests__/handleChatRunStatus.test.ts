import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { handleChatRunStatus } from "@/lib/chat/runs/handleChatRunStatus";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getRun } from "workflow/api";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));
vi.mock("workflow/api", () => ({
  getRun: vi.fn(),
}));

const req = () =>
  new NextRequest("https://x.test/api/chat/runs/wrun_abc", {
    headers: { "x-api-key": "recoup_sk_test" },
  });

const okAuth = { accountId: "acc-1", orgId: null, authToken: "recoup_sk_test" };

describe("handleChatRunStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
  });

  it("returns 200 { runId, status } mapping the workflow status", async () => {
    vi.mocked(getRun).mockReturnValue({ status: Promise.resolve("running") } as never);
    const res = await handleChatRunStatus(req(), "wrun_abc");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ runId: "wrun_abc", status: "running" });
  });

  it("normalizes pending → running and completed/failed/cancelled through", async () => {
    for (const [raw, want] of [
      ["pending", "running"],
      ["completed", "completed"],
      ["failed", "failed"],
      ["cancelled", "cancelled"],
    ] as const) {
      vi.mocked(getRun).mockReturnValue({ status: Promise.resolve(raw) } as never);
      const res = await handleChatRunStatus(req(), "wrun_abc");
      expect((await res.json()).status).toBe(want);
    }
  });

  it("returns the auth error short-circuit", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );
    const res = await handleChatRunStatus(req(), "wrun_abc");
    expect(res.status).toBe(401);
    expect(getRun).not.toHaveBeenCalled();
  });

  it("404s when the run is not found (getRun throws)", async () => {
    vi.mocked(getRun).mockImplementation(() => {
      throw new Error("run not found");
    });
    const res = await handleChatRunStatus(req(), "wrun_missing");
    expect(res.status).toBe(404);
  });
});
