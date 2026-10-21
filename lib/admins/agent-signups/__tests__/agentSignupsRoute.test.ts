import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, OPTIONS } from "@/app/api/admins/agent-signups/route";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { getAgentSignups } from "@/lib/supabase/account_api_keys/getAgentSignups";

vi.mock("@/lib/admins/validateAdminAuth", () => ({ validateAdminAuth: vi.fn() }));
vi.mock("@/lib/supabase/account_api_keys/getAgentSignups", () => ({ getAgentSignups: vi.fn() }));

const rows = [
  {
    id: "record-1",
    name: "Agent key",
    email: "agent+fixture@example.com",
    created_at: "2026-10-21T12:00:00Z",
  },
];
function request(query = "") {
  return new NextRequest(`https://example.com/api/admins/agent-signups${query}`);
}

describe("agent-signup report actual GET and validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T23:30:00Z"));
    vi.mocked(validateAdminAuth).mockResolvedValue({
      accountId: "admin",
      orgId: null,
      authToken: "fixture",
    });
    vi.mocked(getAgentSignups).mockResolvedValue(rows);
  });
  afterEach(() => vi.useRealTimers());

  it("defaults to all and returns the flat metadata response", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success", total: 1, signups: rows });
    expect(getAgentSignups).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it.each([
    ["all", undefined],
    ["daily", "2026-10-21T00:00:00.000Z"],
    ["weekly", "2026-10-15T00:00:00.000Z"],
    ["monthly", "2026-09-22T00:00:00.000Z"],
  ])("uses shared UTC boundaries for %s", async (period, cutoff) => {
    expect((await GET(request(`?period=${period}`))).status).toBe(200);
    expect(getAgentSignups).toHaveBeenCalledExactlyOnceWith(cutoff);
  });

  it("returns zero only for a successful empty read", async () => {
    vi.mocked(getAgentSignups).mockResolvedValue([]);
    expect(await (await GET(request())).json()).toEqual({
      status: "success",
      total: 0,
      signups: [],
    });
  });

  it.each([401, 403])("does not query metadata when admin auth returns %i", async status => {
    vi.mocked(validateAdminAuth).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status }),
    );
    expect((await GET(request())).status).toBe(status);
    expect(getAgentSignups).not.toHaveBeenCalled();
  });

  it.each(["yearly", "", "DAILY"])(
    "rejects invalid period %s before the database helper",
    async period => {
      const response = await GET(request(`?period=${period}`));
      expect(response.status).toBe(400);
      expect(getAgentSignups).not.toHaveBeenCalled();
    },
  );

  it("returns500 instead of a misleading zero if the query fails", async () => {
    vi.mocked(getAgentSignups).mockRejectedValue(new Error("internal fixture detail"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", message: "Internal server error" });
  });

  it("answers preflight without authentication or data access", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(validateAdminAuth).not.toHaveBeenCalled();
    expect(getAgentSignups).not.toHaveBeenCalled();
  });
});
