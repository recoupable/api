import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getCatalogPlaycountHistoryHandler } from "../getCatalogPlaycountHistoryHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCatalogPlaycountHistory } from "../getCatalogPlaycountHistory";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("../getCatalogPlaycountHistory", () => ({ getCatalogPlaycountHistory: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
const id = "740d5050-40ec-4892-a040-b78bb50fef2f";
const request = (suffix = "") =>
  new NextRequest(
    `http://localhost/api/catalogs/${id}/playcount-history?since=2026-09-03&days=2${suffix}`,
  );
describe("getCatalogPlaycountHistoryHandler", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "authenticated",
      orgId: null,
      authToken: "fixture",
    });
    vi.mocked(getCatalogPlaycountHistory).mockResolvedValue({ data: { recordings: [] } } as never);
  });
  it("denies unauthenticated requests before domain reads", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(NextResponse.json({}, { status: 401 }));
    expect((await getCatalogPlaycountHistoryHandler(request(), id)).status).toBe(401);
    expect(getCatalogPlaycountHistory).not.toHaveBeenCalled();
  });
  it("uses validated identity and flat no-store responses", async () => {
    const result = await getCatalogPlaycountHistoryHandler(request(), id);
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.json()).toEqual({ status: "success", recordings: [] });
    expect(getCatalogPlaycountHistory).toHaveBeenCalledWith("authenticated", {
      catalog_id: id,
      since: "2026-09-03",
      days: 2,
      page: 1,
      limit: 25,
    });
  });
  it.each(["&account_id=" + id, "&catalog_id=" + id, "&days=3"])(
    "rejects overrides and duplicate parameters %s",
    async suffix => {
      expect((await getCatalogPlaycountHistoryHandler(request(suffix), id)).status).toBe(400);
      expect(getCatalogPlaycountHistory).not.toHaveBeenCalled();
    },
  );
  it("preserves scoped not-found errors", async () => {
    vi.mocked(getCatalogPlaycountHistory).mockResolvedValue({
      status: 404,
      error: "Catalog not found",
    });
    expect((await getCatalogPlaycountHistoryHandler(request(), id)).status).toBe(404);
  });
  it("returns failure when history cannot be read", async () => {
    vi.mocked(getCatalogPlaycountHistory).mockRejectedValue(new Error("unavailable"));
    expect((await getCatalogPlaycountHistoryHandler(request(), id)).status).toBe(503);
  });
});
