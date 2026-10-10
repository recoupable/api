import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { manageCatalogStreamTracking } from "../manageCatalogStreamTracking";
import { catalogStreamsHandler } from "../catalogStreamsHandler";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("../getCatalogStreams", () => ({
  getCatalogStreams: vi.fn().mockResolvedValue({ data: { recordings: [] } }),
}));
vi.mock("../manageCatalogStreamTracking", () => ({
  manageCatalogStreamTracking: vi.fn().mockResolvedValue({ data: { tracking: null } }),
}));
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: "derived-account",
    orgId: null,
    authToken: "test",
  });
});
describe("catalog streams HTTP", () => {
  it("requires authentication before tracking mutation", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(NextResponse.json({}, { status: 401 }));
    const r = await catalogStreamsHandler(
      new NextRequest("https://local/api", {
        method: "POST",
        body: JSON.stringify({ action: "enable" }),
      }),
      id,
      "tracking",
    );
    expect(r.status).toBe(401);
    expect(manageCatalogStreamTracking).not.toHaveBeenCalled();
  });
  it("passes the authenticated account and authoritative path ID", async () => {
    const r = await catalogStreamsHandler(
      new NextRequest("https://local/api", {
        method: "POST",
        body: JSON.stringify({ action: "enable" }),
      }),
      id,
      "tracking",
    );
    expect(r.status).toBe(200);
    expect(manageCatalogStreamTracking).toHaveBeenCalledWith("derived-account", {
      catalog_id: id,
      action: "enable",
    });
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it.each([
    { action: "enable", account_id: "other" },
    { action: "enable", catalog_id: id },
    { action: "status" },
  ])("rejects overrides or invalid action", async body => {
    const r = await catalogStreamsHandler(
      new NextRequest("https://local/api", { method: "POST", body: JSON.stringify(body) }),
      id,
      "tracking",
    );
    expect(r.status).toBe(400);
    expect(manageCatalogStreamTracking).not.toHaveBeenCalled();
  });
  it("rejects duplicate history parameters", async () => {
    const r = await catalogStreamsHandler(
      new NextRequest("https://local/api?since=2026-09-01&since=2026-09-02&days=1"),
      id,
      "history",
    );
    expect(r.status).toBe(400);
  });
});
