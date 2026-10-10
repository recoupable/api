import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/players/fans/route";
import { SiteError } from "@/lib/sites/SiteError";
const m = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: m.auth }));
vi.mock("@/lib/players/readWorkspacePlayerFans", () => ({ readWorkspacePlayerFans: m.read }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ accountId: "member" });
});
it("requires authentication before invoking the workspace reader", async () => {
  m.auth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  expect((await GET(new NextRequest("https://api.example/api/players/fans"))).status).toBe(401);
  expect(m.read).not.toHaveBeenCalled();
});
it("uses authenticated identity, forwards only the query and prevents shared caching", async () => {
  m.read.mockResolvedValue({ fans: [], scope: "workspace", marketingConsent: false });
  const response = await GET(
    new NextRequest("https://api.example/api/players/fans?organizationId=org&offset=50"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(m.read).toHaveBeenCalledWith("member", { organizationId: "org", offset: "50" });
});
it("does not disclose fan data or internal errors on denied/failed reads", async () => {
  m.read.mockRejectedValue(new SiteError(403, "Workspace access denied"));
  expect((await GET(new NextRequest("https://api.example/api/players/fans"))).status).toBe(403);
  m.read.mockRejectedValue(new Error("private database detail"));
  const response = await GET(new NextRequest("https://api.example/api/players/fans"));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Fan list unavailable" });
});
