import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { selectAccountApiKeys } from "@/lib/supabase/account_api_keys/selectAccountApiKeys";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
vi.mock("@/lib/keys/hashApiKey", () => ({ hashApiKey: (k: string) => `hashed_${k}` }));
vi.mock("@/lib/const", () => ({ PRIVY_PROJECT_SECRET: "test_secret" }));
vi.mock("@/lib/supabase/account_api_keys/selectAccountApiKeys", () => ({
  selectAccountApiKeys: vi.fn(),
}));

function req(apiKey?: string) {
  const headers = new Headers();
  if (apiKey) headers.set("x-api-key", apiKey);
  return new NextRequest("https://x.test/api", { headers });
}

const baseRow = {
  id: "k",
  account: "acc-1",
  key_hash: "hashed_recoup_sk_x",
  name: "n",
  last_used: null,
  created_at: "2026-01-01T00:00:00Z",
};

describe("getApiKeyAccountId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns accountId for a non-expiring key (expires_at null)", async () => {
    vi.mocked(selectAccountApiKeys).mockResolvedValue([{ ...baseRow, expires_at: null }]);
    expect(await getApiKeyAccountId(req("recoup_sk_x"))).toBe("acc-1");
  });

  it("returns accountId for a future expiry", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    vi.mocked(selectAccountApiKeys).mockResolvedValue([{ ...baseRow, expires_at: future }]);
    expect(await getApiKeyAccountId(req("recoup_sk_x"))).toBe("acc-1");
  });

  it("rejects an expired key with 401", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    vi.mocked(selectAccountApiKeys).mockResolvedValue([{ ...baseRow, expires_at: past }]);
    const res = await getApiKeyAccountId(req("recoup_sk_x"));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });

  it("401 when no x-api-key header", async () => {
    const res = await getApiKeyAccountId(req());
    expect((res as Response).status).toBe(401);
  });
});
