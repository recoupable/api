import Ajv from "ajv";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getMentions } from "@/app/api/admins/coding/slack/route";
import { GET as getOptions } from "@/app/api/admins/coding-agent/slack-tags/route";
import { getSlackTagsQuerySchema } from "@/lib/admins/slack/validateGetSlackTagsQuery";
import fixture from "../fixtures/published-docs.json";

const mocks = vi.hoisted(() => ({
  key: vi.fn(),
  bearer: vi.fn(),
  admin: vi.fn(),
  collect: vi.fn(),
}));
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({ getApiKeyAccountId: mocks.key }));
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: mocks.bearer,
}));
vi.mock("@/lib/admins/checkIsAdmin", () => ({ checkIsAdmin: mocks.admin }));
vi.mock("@/lib/admins/slack/fetchSlackMentions", () => ({ fetchSlackMentions: mocks.collect }));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: () => {
      throw new Error("Unexpected database call in the synthetic Slack contract");
    },
  },
}));

interface OperationContract {
  path: string;
  security: unknown[];
  parameters: Array<{ name: string; schema: Record<string, unknown> }>;
  schemas: Record<string, Record<string, unknown>>;
  examples: Record<string, unknown>;
}
const contract = (
  fixture as unknown as {
    adminCodingSlack?: {
      mentions: OperationContract;
      options: OperationContract;
      queryExample: { tag: string; period: string };
    };
  }
).adminCodingSlack;
const mentions = [
  {
    user_id: "U2",
    user_name: "Bob",
    user_avatar: null,
    prompt: "newer",
    timestamp: "2026-10-20T00:00:00Z",
    channel_id: "C1",
    channel_name: "coding",
    pull_requests: ["https://example.invalid/pr/1"],
  },
  {
    user_id: "U1",
    user_name: "Alice",
    user_avatar: null,
    prompt: "other",
    timestamp: "2026-10-19T00:00:00Z",
    channel_id: "C1",
    channel_name: "coding",
    pull_requests: [],
  },
  {
    user_id: "U2",
    user_name: "Older Bob",
    user_avatar: "https://example.invalid/older.png",
    prompt: "older",
    timestamp: "2026-10-18T00:00:00Z",
    channel_id: "C1",
    channel_name: "coding",
    pull_requests: [],
  },
];
const request = (path: string, headers: Record<string, string> = { "x-api-key": "fixture" }) =>
  new NextRequest(`https://example.invalid${path}`, { headers });

function matches(operation: OperationContract, status: number, body: unknown) {
  const validate = new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(
    operation.schemas[String(status)],
  );
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network call in Slack contract");
    }),
  );
  mocks.key.mockResolvedValue("fixture-admin");
  mocks.bearer.mockResolvedValue("fixture-admin");
  mocks.admin.mockResolvedValue(true);
  mocks.collect.mockResolvedValue(mentions);
});

afterEach(() => vi.unstubAllGlobals());

describe("published coding Slack author contracts", () => {
  it("declares the filter and separate admin options operation", () => {
    expect(contract).toBeDefined();
    expect(contract!.mentions.path).toBe("/api/admins/coding/slack");
    expect(contract!.options.path).toBe("/api/admins/coding-agent/slack-tags");
    for (const operation of [contract!.mentions, contract!.options]) {
      expect(operation.security).toEqual([{ apiKeyAuth: [] }, { bearerAuth: [] }]);
    }
    expect(contract!.options.parameters).toEqual([]);
    const tag = contract!.mentions.parameters.find(p => p.name === "tag")!;
    const validate = new Ajv({ strict: false }).compile(tag.schema);
    expect(validate(contract!.queryExample.tag)).toBe(true);
    for (const invalid of ["", "   "]) {
      expect(validate(invalid)).toBe(false);
      expect(getSlackTagsQuerySchema.safeParse({ tag: invalid }).success).toBe(false);
    }
  });

  it.each([{ "x-api-key": "fixture" }, { authorization: "Bearer fixture" }])(
    "runs the copied filter with %s and recomputes totals",
    async headers => {
      expect(contract).toBeDefined();
      const query = new URLSearchParams(contract!.queryExample).toString();
      const response = await getMentions(request(`${contract!.mentions.path}?${query}`, headers));
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        total: 2,
        total_pull_requests: 1,
        tags_with_pull_requests: 1,
        tags: [mentions[0], mentions[2]],
      });
      matches(contract!.mentions, 200, body);
      expect(mocks.collect).toHaveBeenCalledExactlyOnceWith(contract!.queryExample.period);
    },
  );

  it("retains omitted filtering and trims exact case-sensitive IDs after collection", async () => {
    expect(contract).toBeDefined();
    const all = await getMentions(request(contract!.mentions.path));
    expect((await all.json()).total).toBe(3);
    for (const [tag, total] of [
      [" U2 ", 2],
      ["u2", 0],
      ["UNKNOWN", 0],
    ] as const) {
      const response = await getMentions(
        request(`${contract!.mentions.path}?tag=${encodeURIComponent(tag)}`),
      );
      const body = await response.json();
      expect(body.total).toBe(total);
      matches(contract!.mentions, 200, body);
    }
    expect(mocks.collect).toHaveBeenCalledTimes(4);
  });

  it("returns the published distinct first-profile options and empty example", async () => {
    expect(contract).toBeDefined();
    const response = await getOptions(request(contract!.options.path));
    const body = await response.json();
    expect(body).toEqual(contract!.options.examples.collectedAuthors);
    matches(contract!.options, 200, body);
    expect(mocks.collect).toHaveBeenCalledExactlyOnceWith("all");
    mocks.collect.mockResolvedValueOnce([]);
    const empty = await getOptions(request(contract!.options.path));
    const emptyBody = await empty.json();
    expect(emptyBody).toEqual(contract!.options.examples.noAuthors);
    matches(contract!.options, 200, emptyBody);
    const schema = contract!.options.schemas["200"] as {
      properties: { tags: { items: { required: string[] } } };
    };
    expect(schema.properties.tags.items.required).toEqual(["id", "name", "avatar"]);
  });

  it.each(["tag=", "tag=%20%20", "period=yearly"])(
    "declares invalid query %s before collection",
    async query => {
      expect(contract).toBeDefined();
      const response = await getMentions(request(`${contract!.mentions.path}?${query}`));
      expect(response.status).toBe(400);
      matches(contract!.mentions, 400, await response.json());
      expect(mocks.collect).not.toHaveBeenCalled();
    },
  );

  it.each([getMentions, getOptions])(
    "preserves both 401 envelopes and 403 before collection",
    async handler => {
      expect(contract).toBeDefined();
      const operation = handler === getMentions ? contract!.mentions : contract!.options;
      const missing = await handler(request(operation.path, {}));
      expect(missing.status).toBe(401);
      matches(operation, 401, await missing.json());
      mocks.key.mockResolvedValueOnce(
        NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
      );
      const invalid = await handler(request(operation.path));
      expect(invalid.status).toBe(401);
      matches(operation, 401, await invalid.json());
      mocks.admin.mockResolvedValueOnce(false);
      const forbidden = await handler(request(operation.path));
      expect(forbidden.status).toBe(403);
      matches(operation, 403, await forbidden.json());
      expect(mocks.collect).not.toHaveBeenCalled();
    },
  );

  it.each([getMentions, getOptions])(
    "declares thrown collection failures without exposing internal detail",
    async handler => {
      expect(contract).toBeDefined();
      const operation = handler === getMentions ? contract!.mentions : contract!.options;
      mocks.collect.mockRejectedValueOnce(new Error("synthetic-private-canary"));
      const response = await handler(request(operation.path));
      const body = await response.json();
      expect(response.status).toBe(500);
      matches(operation, 500, body);
      expect(JSON.stringify(body)).not.toContain("synthetic-private-canary");
    },
  );
});
