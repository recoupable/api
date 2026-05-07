import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { noSandboxResponse } from "@/lib/sandbox/noSandboxResponse";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const baseRow = {
  id: "sess-1",
  account_id: "acc-1",
  sandbox_state: null,
  lifecycle_state: null,
  lifecycle_version: 0,
  sandbox_expires_at: null,
  hibernate_after: null,
  last_activity_at: null,
  snapshot_url: null,
};

describe("noSandboxResponse", () => {
  it("returns a 200 NextResponse with status='no_sandbox'", async () => {
    const res = noSandboxResponse(baseRow as never);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("no_sandbox");
  });

  it("derives hasSnapshot from snapshot_url presence", async () => {
    const withSnap = await noSandboxResponse({
      ...baseRow,
      snapshot_url: "snap://x",
    } as never).json();
    const without = await noSandboxResponse(baseRow as never).json();

    expect(withSnap.hasSnapshot).toBe(true);
    expect(without.hasSnapshot).toBe(false);
  });

  it("includes the lifecycle envelope projected from the row", async () => {
    const body = await noSandboxResponse(baseRow as never).json();

    expect(body.lifecycle).toMatchObject({
      serverTime: expect.any(Number),
      state: null,
      lastActivityAt: null,
      hibernateAfter: null,
      sandboxExpiresAt: null,
    });
  });
});
