import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { processPackOperation } from "../processPackOperation";
import { handlePackRequest } from "../handlePackRequest";
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: "owner", orgId: null })),
}));
vi.mock("../processPackOperation", async () => {
  const schemas = await import("../releasePackSchema");
  return {
    packOperationSchemas: {
      prepare: schemas.prepareReleasePackSchema,
      get: schemas.releasePackLocatorSchema,
      estimate: schemas.estimateReleasePackSchema,
      generate: schemas.approveReleasePackSchema,
      retry: schemas.retryReleasePackSchema,
      upload: schemas.uploadPackAssetSchema,
      export: schemas.releasePackLocatorSchema,
    },
    processPackOperation: vi.fn(async () => ({ job: { id: "saved" }, assets: [] })),
  };
});
const id = "d609f096-2046-47ed-845e-3109eb17e408";
describe("release pack authenticated transports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("injects the route job id and passes validated account identity to the shared domain", async () => {
    const response = await handlePackRequest(
      new NextRequest(`https://api.example/content/packs/${id}`),
      "get",
      id,
    );
    expect(response.status).toBe(200);
    expect(processPackOperation).toHaveBeenCalledWith("owner", "get", { job_id: id }, null);
  });
  it("rejects caller account_id and conflicting route identities before domain execution", async () => {
    for (const body of [{ account_id: id }, { job_id: "a9999999-1111-4111-8111-111111111111" }]) {
      const response = await handlePackRequest(
        new NextRequest(`https://api.example/content/packs/${id}/generate`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
        "generate",
        id,
      );
      expect(response.status).toBe(400);
    }
    expect(processPackOperation).not.toHaveBeenCalled();
  });
  it("returns a controlled credit shortfall with recovery URL", async () => {
    vi.mocked(processPackOperation).mockRejectedValueOnce(
      new Error("Insufficient credits; your brief and quote are saved"),
    );
    const response = await handlePackRequest(
      new NextRequest(`https://api.example/content/packs/${id}`),
      "get",
      id,
    );
    expect(response.status).toBe(402);
    expect((await response.json()).billingUrl).toMatch(/^https:\/\//);
  });
  it("preserves authentication failures without calling production", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json({ error: "not connected" }, { status: 401 }),
    );
    const response = await handlePackRequest(
      new NextRequest(`https://api.example/content/packs/${id}`),
      "get",
      id,
    );
    expect(response.status).toBe(401);
    expect(processPackOperation).not.toHaveBeenCalled();
  });
});
