import Ajv from "ajv";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admins/agent-signups/route";
import fixture from "../fixtures/published-docs.json";

const mocks = vi.hoisted(() => ({
  key: vi.fn(),
  bearer: vi.fn(),
  admin: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({ getApiKeyAccountId: mocks.key }));
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: mocks.bearer,
}));
vi.mock("@/lib/admins/checkIsAdmin", () => ({ checkIsAdmin: mocks.admin }));
vi.mock("@/lib/supabase/account_api_keys/getAgentSignups", () => ({
  getAgentSignups: mocks.read,
}));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: () => {
      throw new Error("Unexpected database access in metadata contract");
    },
  },
}));

interface MetadataContract {
  path: string;
  description: string;
  security: unknown[];
  parameters: Array<{ name: string; description: string; schema: Record<string, unknown> }>;
  schemas: Record<string, Record<string, unknown>>;
  examples: Record<string, { status: string; total: number; signups: unknown[] }>;
}
const contract = (fixture as unknown as { agentSignupMetadata?: MetadataContract })
  .agentSignupMetadata;
const request = (query = "", headers: Record<string, string> = { "x-api-key": "fixture" }) =>
  new NextRequest(`https://example.invalid/api/admins/agent-signups${query}`, { headers });

function matches(status: number, body: unknown) {
  const validate = new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(
    contract!.schemas[String(status)],
  );
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T23:30:00Z"));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network access in metadata contract");
    }),
  );
  mocks.key.mockResolvedValue("fixture-admin");
  mocks.bearer.mockResolvedValue("fixture-admin");
  mocks.admin.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("published admin agent-prefixed key metadata", () => {
  it("declares the implemented URL and optional all-default calendar periods", () => {
    expect(contract).toBeDefined();
    expect(contract!.path).toBe("/api/admins/agent-signups");
    expect(contract!.security).toEqual([{ apiKeyAuth: [] }, { bearerAuth: [] }]);
    expect(contract!.parameters.map(parameter => parameter.name)).toEqual(["period"]);
    expect(contract!.parameters[0].schema).toMatchObject({
      type: "string",
      enum: ["all", "daily", "weekly", "monthly"],
      default: "all",
    });
    expect(contract!.parameters[0].description).toContain("00:00 UTC");
  });

  it.each([{ "x-api-key": "fixture" }, { authorization: "Bearer fixture" }])(
    "returns the copied metadata example and counts returned key records with %s",
    async headers => {
      expect(contract).toBeDefined();
      const example = contract!.examples.multipleKeys;
      mocks.read.mockResolvedValue(example.signups);
      const response = await GET(request("", headers));
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toEqual(example);
      expect(body.total).toBe(body.signups.length);
      expect(body.signups).toHaveLength(2);
      expect(body.signups[0].email).toBe(body.signups[1].email);
      expect(body.signups[0].id).not.toBe(body.signups[1].id);
      for (const row of body.signups) {
        expect(Object.keys(row).sort()).toEqual(["created_at", "email", "id", "name"]);
      }
      matches(200, body);
      expect(mocks.read).toHaveBeenCalledExactlyOnceWith(undefined);
    },
  );

  it.each([
    ["all", undefined],
    ["daily", "2026-10-21T00:00:00.000Z"],
    ["weekly", "2026-10-15T00:00:00.000Z"],
    ["monthly", "2026-09-22T00:00:00.000Z"],
  ])("applies the published UTC calendar meaning of %s", async (period, cutoff) => {
    expect(contract).toBeDefined();
    mocks.read.mockResolvedValue([]);
    const response = await GET(request(`?period=${period}`));
    expect(response.status).toBe(200);
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(cutoff);
    matches(200, await response.json());
  });

  it("returns the published empty response only after a successful metadata read", async () => {
    expect(contract).toBeDefined();
    mocks.read.mockResolvedValue([]);
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual(contract!.examples.noRecords);
    matches(200, body);
    expect(mocks.read).toHaveBeenCalledOnce();
  });

  it.each(["", "yearly", "DAILY"])("rejects period=%s before reading metadata", async period => {
    expect(contract).toBeDefined();
    const response = await GET(request(`?period=${period}`));
    expect(response.status).toBe(400);
    matches(400, await response.json());
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("preserves both 401 envelopes and rejects conflicting credentials before reading", async () => {
    expect(contract).toBeDefined();
    const missing = await GET(request("?period=yearly", {}));
    expect(missing.status).toBe(401);
    matches(401, await missing.json());
    const conflicting = await GET(
      request("", { "x-api-key": "fixture", authorization: "Bearer fixture" }),
    );
    expect(conflicting.status).toBe(401);
    matches(401, await conflicting.json());
    mocks.key.mockResolvedValueOnce(
      NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
    );
    const invalid = await GET(request());
    expect(invalid.status).toBe(401);
    matches(401, await invalid.json());
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("checks admin membership before parsing the query or reading metadata", async () => {
    expect(contract).toBeDefined();
    mocks.admin.mockResolvedValue(false);
    const response = await GET(request("?period=yearly"));
    expect(response.status).toBe(403);
    matches(403, await response.json());
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("returns a masked 500 rather than an empty report when the read fails", async () => {
    expect(contract).toBeDefined();
    mocks.read.mockRejectedValue(new Error("synthetic-private-canary"));
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toEqual({ status: "error", message: "Internal server error" });
    matches(500, body);
  });

  it("declares every row field and excludes credential values from its schema", () => {
    expect(contract).toBeDefined();
    const schema = contract!.schemas["200"] as {
      properties: {
        signups: { items: { properties: Record<string, unknown>; required: string[] } };
      };
    };
    const row = schema.properties.signups.items;
    expect(Object.keys(row.properties).sort()).toEqual(["created_at", "email", "id", "name"]);
    expect([...row.required].sort()).toEqual(["created_at", "email", "id", "name"]);
  });
});
