import Ajv from "ajv";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/comments/route";
import { validateGetCommentsQuery } from "@/lib/comments/validateGetCommentsQuery";
import fixture from "../fixtures/published-docs.json";

const mocks = vi.hoisted(() => ({
  key: vi.fn(),
  bearer: vi.fn(),
  access: vi.fn(),
  account: vi.fn(),
  socials: vi.fn(),
  comments: vi.fn(),
}));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: () => {
      throw new Error("Unexpected database call outside the synthetic contract fixture");
    },
  },
}));
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({ getApiKeyAccountId: mocks.key }));
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: mocks.bearer,
}));
vi.mock("@/lib/comments/canReadCreatorComments", () => ({ canReadCreatorComments: mocks.access }));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: mocks.account }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocialIds", () => ({
  selectAccountSocialIds: mocks.socials,
}));
vi.mock("@/lib/supabase/post_comments/selectStoredPostComments", () => ({
  selectStoredPostComments: mocks.comments,
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

// The fixture is generated only from the maintained OpenAPI document. It may
// not exist before the coordinated source/fixture correction is generated.
const contract = (
  fixture as unknown as {
    storedComments?: {
      method: string;
      path: string;
      security: unknown[];
      parameters: Array<{
        name: string;
        required?: boolean;
        schema: Record<string, unknown>;
        example?: unknown;
        description?: string;
      }>;
      schemas: Record<string, Record<string, unknown>>;
      headers: Record<string, { "Cache-Control": { schema: { const: string } } }>;
      queryExample: Record<string, string | number>;
      example: {
        status: string;
        comments: Array<Record<string, unknown>>;
        pagination: { total_count: number; page: number; limit: number; total_pages: number };
      };
    };
  }
).storedComments;
const artist = "11111111-1111-4111-8111-111111111111";
const request = (query: string, headers: Record<string, string> = { "x-api-key": "dummy" }) =>
  new NextRequest(`https://fixture.invalid/api/comments?${query}`, { headers });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.key.mockResolvedValue("caller_fixture");
  mocks.bearer.mockResolvedValue("caller_fixture");
  mocks.access.mockResolvedValue(true);
  mocks.account.mockResolvedValue([{ id: artist }]);
  mocks.socials.mockResolvedValue(["creator_social_fixture"]);
});

function matches(status: number, body: unknown) {
  expect(contract).toBeDefined();
  const validate = new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile(
    contract!.schemas[String(status)],
  );
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
}

describe("published stored comments contract", () => {
  it("declares required request identity, effective pagination and the five-field nullable projection", () => {
    expect(contract).toBeDefined();
    expect(contract).toMatchObject({
      method: "GET",
      path: "/api/comments",
      security: [{ apiKeyAuth: [] }, { bearerAuth: [] }],
    });
    expect(contract!.parameters.map(value => value.name)).toEqual([
      "artist_account_id",
      "post_id",
      "page",
      "limit",
    ]);
    const target = contract!.parameters.find(value => value.name === "artist_account_id")!;
    expect(target).toMatchObject({ required: true, schema: { type: "string", format: "uuid" } });
    const limit = contract!.parameters.find(value => value.name === "limit")!;
    expect(limit.schema).toMatchObject({ type: "integer", minimum: 1, default: 10 });
    // Larger positive requests are accepted and clamped, not rejected by a
    // maximum=100 request declaration. The response carries the effective cap.
    expect(limit.schema).not.toHaveProperty("maximum");
    expect(limit.description).toContain("clamped to 100");
    const schema = contract!.schemas["200"] as {
      properties: {
        comments: { items: { properties: Record<string, { type: unknown }>; required: string[] } };
        pagination: { properties: { limit: { maximum: number } } };
      };
    };
    const comment = schema.properties.comments.items;
    expect(Object.keys(comment.properties).sort()).toEqual([
      "comment",
      "commented_at",
      "id",
      "post_id",
      "social_id",
    ]);
    expect([...comment.required].sort()).toEqual([
      "comment",
      "commented_at",
      "id",
      "post_id",
      "social_id",
    ]);
    for (const field of ["post_id", "social_id", "comment"]) {
      expect(comment.properties[field].type).toEqual(["string", "null"]);
      expect(comment.properties[field]).not.toHaveProperty("nullable");
    }
    expect(schema.properties.pagination.properties.limit.maximum).toBe(100);
    expect(Object.keys(contract!.schemas).sort()).toEqual(["200", "400", "401", "403", "500"]);
  });

  it.each([{ "x-api-key": "dummy" }, { authorization: "Bearer dummy" }])(
    "executes the published query and response with %s",
    async headers => {
      expect(contract).toBeDefined();
      const example = contract!.example;
      const query = new URLSearchParams(
        Object.entries(contract!.queryExample).map(([key, value]) => [key, String(value)]),
      ).toString();
      const parsed = validateGetCommentsQuery(new URLSearchParams(query));
      expect(parsed).toMatchObject({
        artist_account_id: artist,
        page: example.pagination.page,
        limit: example.pagination.limit,
      });
      mocks.comments.mockResolvedValue({
        comments: example.comments,
        totalCount: example.pagination.total_count,
      });
      const response = await GET(request(query, headers));
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toEqual(example);
      matches(200, body);
      expect(response.headers.get("cache-control")).toBe(
        contract!.headers["200"]["Cache-Control"].schema.const,
      );
      expect(mocks.comments).toHaveBeenCalledWith({
        socialIds: ["creator_social_fixture"],
        postId: contract!.queryExample.post_id,
        page: example.pagination.page,
        limit: example.pagination.limit,
      });
    },
  );

  it("keeps request clamping and offset rejection distinct", async () => {
    expect(
      validateGetCommentsQuery(
        new URLSearchParams(`artist_account_id=${artist}&page=2&limit=1000`),
      ),
    ).toMatchObject({ page: 2, limit: 100 });
    const response = await GET(request(`artist_account_id=${artist}&page=2147483647&limit=100`));
    expect(response.status).toBe(400);
    matches(400, await response.json());
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.comments).not.toHaveBeenCalled();
  });

  it.each([
    "",
    `artist_account_id=${artist}&account_id=foreign`,
    `artist_account_id=${artist}&page=1&page=2`,
    `artist_account_id=${artist}&post_id=https://fixture.invalid/post`,
  ])("matches the declared validation envelope for %s", async query => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    matches(400, await response.json());
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.comments).not.toHaveBeenCalled();
  });

  it.each([{}, { "x-api-key": "dummy", authorization: "Bearer dummy" }])(
    "declares real mechanism-selection errors for %s",
    async headers => {
      const response = await GET(request(`artist_account_id=${artist}`, headers));
      expect(response.status).toBe(401);
      matches(401, await response.json());
      expect(mocks.comments).not.toHaveBeenCalled();
    },
  );

  it("accepts both declared authentication envelope variants and rejects missing error/message", () => {
    matches(401, { status: "error", error: "Exactly one credential is required" });
    matches(401, { status: "error", message: "Unauthorized" });
    const validate = new Ajv({ strict: false }).compile(contract!.schemas["401"]);
    expect(validate({ status: "error" })).toBe(false);
  });

  it.each(["denied", "missing", "storage"])(
    "matches the declared %s target/error response",
    async scenario => {
      if (scenario === "denied") mocks.access.mockResolvedValue(false);
      if (scenario === "missing") mocks.account.mockResolvedValue([]);
      if (scenario === "storage")
        mocks.comments.mockRejectedValue(new Error("private_canary_connection"));
      const response = await GET(request(`artist_account_id=${artist}`));
      const body = await response.json();
      expect(response.status).toBe(scenario === "storage" ? 500 : 403);
      matches(response.status, body);
      expect(JSON.stringify(body)).not.toContain("private_canary_connection");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("rejects wrong nullable-field types, extra joined metadata and omitted projected fields", () => {
    expect(contract).toBeDefined();
    const validate = new Ajv({ strict: false, validateFormats: false }).compile(
      contract!.schemas["200"],
    );
    const body = contract!.example;
    matches(200, body);
    for (const field of ["post_id", "social_id", "comment"]) {
      expect(validate({ ...body, comments: [{ ...body.comments[0], [field]: null }] })).toBe(true);
      expect(validate({ ...body, comments: [{ ...body.comments[0], [field]: 123 }] })).toBe(false);
    }
    expect(
      validate({ ...body, comments: [{ ...body.comments[0], posts: { protected: true } }] }),
    ).toBe(false);
    const { commented_at: _omitted, ...incomplete } = body.comments[0];
    expect(validate({ ...body, comments: [incomplete] })).toBe(false);
  });
});
