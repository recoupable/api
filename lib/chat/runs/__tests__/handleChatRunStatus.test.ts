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
    expect(await res.json()).toEqual({
      runId: "wrun_abc",
      status: "running",
      createdAt: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
    });
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

describe("handleChatRunStatus timing (chat#2006 item 4a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
  });

  it("returns createdAt / startedAt / completedAt / durationMs from the workflow run", async () => {
    vi.mocked(getRun).mockReturnValue({
      status: Promise.resolve("completed"),
      createdAt: Promise.resolve(new Date("2026-08-25T19:33:56.000Z")),
      startedAt: Promise.resolve(new Date("2026-08-25T19:34:16.386Z")),
      completedAt: Promise.resolve(new Date("2026-08-25T20:15:55.000Z")),
    } as never);
    const res = await handleChatRunStatus(req(), "wrun_abc");
    expect(await res.json()).toEqual({
      runId: "wrun_abc",
      status: "completed",
      createdAt: "2026-08-25T19:33:56.000Z",
      startedAt: "2026-08-25T19:34:16.386Z",
      completedAt: "2026-08-25T20:15:55.000Z",
      durationMs: 2498614,
    });
  });

  it("nulls the timing fields that are not set yet on a running run", async () => {
    vi.mocked(getRun).mockReturnValue({
      status: Promise.resolve("running"),
      createdAt: Promise.resolve(new Date("2026-08-25T19:33:56.000Z")),
      startedAt: Promise.resolve(new Date("2026-08-25T19:34:16.386Z")),
      completedAt: Promise.resolve(undefined),
    } as never);
    const body = await (await handleChatRunStatus(req(), "wrun_abc")).json();
    expect(body.startedAt).toBe("2026-08-25T19:34:16.386Z");
    expect(body.completedAt).toBeNull();
    expect(body.durationMs).toBeNull();
  });
});
