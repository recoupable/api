import Ajv from "ajv";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getArtistProfile } from "@/app/api/artists/[id]/profile/route";
import { GET as getProject } from "@/app/api/projects/[projectId]/route";
import { getArtistPublicProfile } from "@/lib/artist/getArtistPublicProfile";
import { getAccountIdByApiKey } from "@/lib/auth/getAccountIdByApiKey";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import { hasProjectAccess } from "@/lib/projects/hasProjectAccess";
import fixture from "../fixtures/published-docs.json";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/artist/getArtistPublicProfile", () => ({ getArtistPublicProfile: vi.fn() }));
vi.mock("@/lib/auth/getAccountIdByApiKey", () => ({ getAccountIdByApiKey: vi.fn() }));
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: vi.fn(),
}));
vi.mock("@/lib/projects/hasProjectAccess", () => ({ hasProjectAccess: vi.fn() }));

const id = "11111111-1111-4111-8111-111111111111";
const ajv = new Ajv({ allErrors: true });
ajv.addKeyword({ keyword: "example", valid: true });

function responseContract(path: string, status: number) {
  const contract = fixture.responseSchemas.find(
    candidate =>
      candidate.method === "GET" && candidate.path === path && candidate.status === status,
  );
  expect(contract, `Missing GET ${path} ${status} response contract`).toBeDefined();
  return ajv.compile(contract!.schema);
}

describe("published response schemas against route exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getArtistPublicProfile).mockResolvedValue(null);
    vi.mocked(getAccountIdByApiKey).mockResolvedValue(null);
    vi.mocked(hasProjectAccess).mockResolvedValue(false);
  });

  it("accepts the actual artist 404 and rejects the historical message-only schema", async () => {
    const response = await getArtistProfile(
      new NextRequest(`https://api.example/api/artists/${id}/profile`),
      { params: Promise.resolve({ id }) },
    );
    const body = await response.json();
    expect(response.status).toBe(404);
    const validate = responseContract("/api/artists/{id}/profile", 404);
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(body).toEqual({ status: "error", error: "Artist not found" });
    expect(
      ajv.validate(
        {
          type: "object",
          required: ["status", "message"],
          properties: {
            status: { type: "string", enum: ["error"] },
            message: { type: "string" },
          },
        },
        body,
      ),
    ).toBe(false);
    expect(validate({ status: body.status })).toBe(false);
  });

  it.each([
    {
      name: "missing credentials",
      headers: {},
      field: "error",
      message: "Exactly one of x-api-key or Authorization must be provided",
    },
    {
      name: "conflicting credentials",
      headers: { authorization: "Bearer invalid-token", "x-api-key": "invalid-key" },
      field: "error",
      message: "Exactly one of x-api-key or Authorization must be provided",
    },
    {
      name: "invalid API key",
      headers: { "x-api-key": "invalid-key" },
      field: "message",
      message: "Unauthorized",
    },
    {
      name: "invalid bearer API key",
      headers: { authorization: "Bearer recoup_sk_invalid" },
      field: "message",
      message: "Unauthorized",
    },
    {
      name: "malformed bearer header",
      headers: { authorization: "invalid-token" },
      field: "message",
      message: "Authorization header with Bearer token required",
    },
    {
      name: "failed token verification",
      headers: { authorization: "Bearer invalid-token" },
      field: "message",
      message: "Failed to verify authentication token",
    },
  ])("accepts Projects 401 from $name", async ({ headers, field, message }) => {
    vi.mocked(getOrCreateAccountIdByAuthToken).mockRejectedValue("invalid test token");
    const response = await getProject(
      new NextRequest(`https://api.example/api/projects/${id}`, { headers }),
      { params: Promise.resolve({ projectId: id }) },
    );
    const body = await response.json();
    expect(response.status).toBe(401);
    const validate = responseContract("/api/projects/{projectId}", 401);
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(body).toEqual({ status: "error", [field]: message });
    expect(validate({ status: body.status })).toBe(false);
    expect(validate({ [field]: message })).toBe(false);
    expect(hasProjectAccess).not.toHaveBeenCalled();
  });

  it("keeps a foreign project indistinguishable from an unknown project", async () => {
    vi.mocked(getAccountIdByApiKey).mockResolvedValue(id);
    const response = await getProject(
      new NextRequest(`https://api.example/api/projects/${id}`, {
        headers: { "x-api-key": "test-key" },
      }),
      { params: Promise.resolve({ projectId: id }) },
    );
    const body = await response.json();
    expect(response.status).toBe(404);
    const validate = responseContract("/api/projects/{projectId}", 404);
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(body).toEqual({ status: "error", error: "Project not found" });
    expect(hasProjectAccess).toHaveBeenCalledExactlyOnceWith(id, id);
  });
});
