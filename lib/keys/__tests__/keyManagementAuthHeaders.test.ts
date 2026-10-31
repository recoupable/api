import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST, DELETE } from "@/app/api/keys/route";
import { getAccountIdByApiKey } from "@/lib/auth/getAccountIdByApiKey";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import { createKey } from "../createKey";
import { getApiKeys } from "@/lib/supabase/account_api_keys/getApiKeys";
import { deleteApiKey } from "@/lib/supabase/account_api_keys/deleteApiKey";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

vi.mock("@/lib/auth/getAccountIdByApiKey", () => ({ getAccountIdByApiKey: vi.fn() }));
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: vi.fn(),
}));
vi.mock("../createKey", () => ({ createKey: vi.fn() }));
vi.mock("@/lib/supabase/account_api_keys/getApiKeys", () => ({ getApiKeys: vi.fn() }));
vi.mock("@/lib/supabase/account_api_keys/deleteApiKey", () => ({ deleteApiKey: vi.fn() }));
vi.mock("@/lib/auth/validateAccountIdOverride", () => ({ validateAccountIdOverride: vi.fn() }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const actor = "account-owner";
const key = { id: "key-owned", account: actor, name: "Existing key" };
const credentials = [
  ["Bearer API key", { authorization: "Bearer recoup_sk_fixture" }],
  ["Privy Bearer", { authorization: "Bearer privy-fixture" }],
  ["x-api-key", { "x-api-key": "recoup_sk_fixture" }],
] as const;
const operations = [
  { name: "list", method: "GET", handler: GET },
  { name: "create", method: "POST", handler: POST },
  { name: "delete", method: "DELETE", handler: DELETE },
] as const;

function request(method: string, headers: Record<string, string>, body?: Record<string, unknown>) {
  return new NextRequest(
    "https://example.test/api/keys?account_id=foreign&organization_id=foreign-org",
    {
      method,
      headers: { "content-type": "application/json", ...headers },
      ...(method === "GET"
        ? {}
        : {
            body: JSON.stringify(
              body ?? (method === "POST" ? { key_name: "New key" } : { id: key.id }),
            ),
          }),
    },
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network forbidden in key handler tests");
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getAccountIdByApiKey).mockImplementation(async token =>
    token === "recoup_sk_fixture" ? actor : null,
  );
  vi.mocked(getOrCreateAccountIdByAuthToken).mockImplementation(async token => {
    if (token !== "privy-fixture") throw new Error("Invalid authentication token");
    return actor;
  });
  vi.mocked(createKey).mockResolvedValue(
    NextResponse.json(
      { key: "synthetic-created-key" },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    ),
  );
  vi.mocked(getApiKeys).mockResolvedValue({ data: [key], error: null } as Awaited<
    ReturnType<typeof getApiKeys>
  >);
  vi.mocked(deleteApiKey).mockResolvedValue({ error: null } as Awaited<
    ReturnType<typeof deleteApiKey>
  >);
});

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  expect(validateAccountIdOverride).not.toHaveBeenCalled();
  expect(validateOrganizationAccess).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

for (const operation of operations) {
  describe(`${operation.name} key header authentication`, () => {
    it.each(credentials)(
      "accepts %s and binds operations to the authenticated owner",
      async (_name, headers) => {
        const body =
          operation.method === "POST"
            ? { key_name: "New key", account_id: "foreign", organization_id: "foreign-org" }
            : { id: key.id, account_id: "foreign", organization_id: "foreign-org" };
        const response = await operation.handler(request(operation.method, headers, body));
        expect(response.status).toBe(200);
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        if (operation.method === "GET") {
          expect(getApiKeys).toHaveBeenCalledExactlyOnceWith({ accountId: actor });
          expect(await response.json()).toEqual({ keys: [key] });
        } else if (operation.method === "POST") {
          expect(createKey).toHaveBeenCalledExactlyOnceWith(actor, "New key");
          expect(await response.json()).toEqual({ key: "synthetic-created-key" });
        } else {
          expect(getApiKeys).toHaveBeenCalledExactlyOnceWith({ id: key.id });
          expect(deleteApiKey).toHaveBeenCalledExactlyOnceWith(key.id);
          expect(await response.json()).toEqual({
            status: "success",
            message: "API key deleted successfully",
          });
        }
        if ("x-api-key" in headers || headers.authorization?.includes("recoup_sk_")) {
          expect(getAccountIdByApiKey).toHaveBeenCalledExactlyOnceWith("recoup_sk_fixture");
          expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
        } else {
          expect(getOrCreateAccountIdByAuthToken).toHaveBeenCalledExactlyOnceWith("privy-fixture");
          expect(getAccountIdByApiKey).not.toHaveBeenCalled();
        }
      },
    );

    it.each([
      ["missing", {}],
      ["invalid x-api-key", { "x-api-key": "recoup_sk_invalid" }],
      ["invalid Bearer API key", { authorization: "Bearer recoup_sk_invalid" }],
      ["invalid Privy Bearer", { authorization: "Bearer privy-invalid" }],
      ["malformed Authorization", { authorization: "Basic fixture" }],
      [
        "both valid headers",
        { authorization: "Bearer privy-fixture", "x-api-key": "recoup_sk_fixture" },
      ],
      [
        "valid Bearer and invalid key",
        { authorization: "Bearer privy-fixture", "x-api-key": "recoup_sk_invalid" },
      ],
      [
        "invalid Bearer and valid key",
        { authorization: "Bearer privy-invalid", "x-api-key": "recoup_sk_fixture" },
      ],
    ])("rejects %s before any key operation", async (_name, headers) => {
      const response = await operation.handler(request(operation.method, headers));
      expect(response.status).toBe(401);
      expect(createKey).not.toHaveBeenCalled();
      expect(getApiKeys).not.toHaveBeenCalled();
      expect(deleteApiKey).not.toHaveBeenCalled();
      if (
        (!("authorization" in headers) && !("x-api-key" in headers)) ||
        ("authorization" in headers && "x-api-key" in headers)
      ) {
        expect(await response.json()).toEqual({
          status: "error",
          error: "Exactly one of x-api-key or Authorization must be provided",
        });
        expect(getAccountIdByApiKey).not.toHaveBeenCalled();
        expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
      }
    });
  });
}

describe("key deletion ownership", () => {
  it.each(credentials)("denies a foreign-owned key with %s", async (_name, headers) => {
    vi.mocked(getApiKeys).mockResolvedValue({
      data: [{ ...key, account: "foreign" }],
      error: null,
    } as Awaited<ReturnType<typeof getApiKeys>>);
    const response = await DELETE(request("DELETE", headers));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ status: "error", message: "Access denied" });
    expect(deleteApiKey).not.toHaveBeenCalled();
  });
});
