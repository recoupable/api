import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { verifyBearerToken } from "../verifyApiKey";
import { selectAccountApiKeys } from "@/lib/supabase/account_api_keys/selectAccountApiKeys";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import { verifyOAuthBearer } from "@/lib/oauth/verifyOAuthBearer";
import { hashApiKey } from "@/lib/keys/hashApiKey";

vi.mock("@/lib/const", () => ({ PRIVY_PROJECT_SECRET: "synthetic-secret" }));
vi.mock("@/lib/supabase/account_api_keys/selectAccountApiKeys", () => ({
  selectAccountApiKeys: vi.fn(),
}));
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: vi.fn(),
}));
vi.mock("@/lib/oauth/verifyOAuthBearer", () => ({ verifyOAuthBearer: vi.fn() }));
const token = "recoup_sk_synthetic";
const request = new Request("https://synthetic.invalid/mcp");

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T12:00:00.000Z"));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network forbidden");
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(verifyOAuthBearer).mockResolvedValue(undefined);
  vi.mocked(getOrCreateAccountIdByAuthToken).mockRejectedValue(new Error("Not a Privy token"));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([
  ["past", "2026-11-17T11:59:59.999Z", false],
  ["exact boundary", "2026-11-17T12:00:00.000Z", false],
  ["future", "2026-11-17T12:00:00.001Z", true],
  ["null expiry", null, true],
  ["missing expiry", undefined, true],
  ["adopted malformed expiry", "not-a-date", true],
])(
  "applies REST key expiry policy for %s through actual MCP fallback",
  async (_, expires_at, valid) => {
    vi.mocked(selectAccountApiKeys).mockResolvedValue([
      { id: "synthetic-key", account: "synthetic-account", expires_at },
    ] as never);
    const result = await verifyBearerToken(request, token);
    expect(selectAccountApiKeys).toHaveBeenCalledExactlyOnceWith({
      keyHash: hashApiKey(token, "synthetic-secret"),
    });
    expect(getOrCreateAccountIdByAuthToken).toHaveBeenCalledExactlyOnceWith(token);
    if (valid) expect(result).toMatchObject({ extra: { accountId: "synthetic-account" } });
    else expect(result).toBeUndefined();
  },
);

it.each([[], null, [{ account: null }]])(
  "denies missing key/account or failed lookup: %j",
  async rows => {
    vi.mocked(selectAccountApiKeys).mockResolvedValue(rows as never);
    expect(await verifyBearerToken(request, token)).toBeUndefined();
  },
);
it("denies a thrown store failure", async () => {
  vi.mocked(selectAccountApiKeys).mockRejectedValue(new Error("Synthetic store failure"));
  expect(await verifyBearerToken(request, token)).toBeUndefined();
});
it("preserves valid delegated OAuth without legacy verification or key lookup", async () => {
  const oauth = {
    accountId: "actor",
    clientId: "client",
    grantId: "grant",
    scopes: ["mcp:tools"],
    expiresAt: 9999999999,
    resource: "https://synthetic.invalid/mcp",
    context: "personal" as const,
  };
  vi.mocked(verifyOAuthBearer).mockResolvedValue(oauth);
  expect(await verifyBearerToken(request, "synthetic-oauth")).toEqual({
    token: "synthetic-oauth",
    scopes: oauth.scopes,
    clientId: oauth.clientId,
    expiresAt: oauth.expiresAt,
    extra: { accountId: oauth.accountId, oauth },
  });
  expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
  expect(selectAccountApiKeys).not.toHaveBeenCalled();
});
it("preserves the existing valid Privy path without key lookup", async () => {
  vi.mocked(getOrCreateAccountIdByAuthToken).mockResolvedValue("privy-actor");
  expect(await verifyBearerToken(request, "synthetic-privy")).toEqual({
    token: "synthetic-privy",
    scopes: ["mcp:tools"],
    clientId: "privy-actor",
    extra: { accountId: "privy-actor" },
  });
  expect(selectAccountApiKeys).not.toHaveBeenCalled();
});
