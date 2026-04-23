import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getCatalogsHandler } from "../getCatalogsHandler";
import { validateGetCatalogsRequest } from "../validateGetCatalogsRequest";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetCatalogsRequest", () => ({
  validateGetCatalogsRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const makeRequest = () =>
  new NextRequest(`http://localhost/api/accounts/${accountId}/catalogs`, { method: "GET" });

describe("getCatalogsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the validator error when validation fails", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetCatalogsRequest).mockResolvedValue(err);

    const res = await getCatalogsHandler(makeRequest(), Promise.resolve({ id: accountId }));

    expect(res).toBe(err);
    expect(selectAccountCatalogs).not.toHaveBeenCalled();
  });

  it("returns 200 with catalogs for the validated account", async () => {
    vi.mocked(validateGetCatalogsRequest).mockResolvedValue({ accountId });
    vi.mocked(selectAccountCatalogs).mockResolvedValue([
      { id: "c1", name: "Catalog A", created_at: "2024-01-01", updated_at: "2024-01-02" },
    ]);

    const res = await getCatalogsHandler(makeRequest(), Promise.resolve({ id: accountId }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(selectAccountCatalogs).toHaveBeenCalledWith(accountId);
    expect(body).toEqual({
      status: "success",
      catalogs: [
        { id: "c1", name: "Catalog A", created_at: "2024-01-01", updated_at: "2024-01-02" },
      ],
    });
  });

  it("returns 500 with a generic error, not the raw exception message", async () => {
    vi.mocked(validateGetCatalogsRequest).mockResolvedValue({ accountId });
    vi.mocked(selectAccountCatalogs).mockRejectedValue(
      new Error("db down: connection refused at 10.0.0.1:5432"),
    );

    const res = await getCatalogsHandler(makeRequest(), Promise.resolve({ id: accountId }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ status: "error", error: "Internal server error" });
    expect(body.error).not.toContain("db down");
    expect(body.error).not.toContain("10.0.0.1");
  });
});
