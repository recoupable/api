import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateUploadConnectorFileRequest } from "../validateUploadConnectorFileRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const buildRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/connectors/files", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("validateUploadConnectorFileRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth error when authentication fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );

    const result = await validateUploadConnectorFileRequest(
      buildRequest({ url: "https://cdn.example.com/a.png", toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST" }),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) expect(result.status).toBe(401);
  });

  it("returns 400 when the body is invalid", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
      orgId: null,
      authToken: "t",
    });

    const result = await validateUploadConnectorFileRequest(buildRequest({ toolSlug: "X" }));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) expect(result.status).toBe(400);
  });

  it("returns the validated { url, toolSlug } on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
      orgId: null,
      authToken: "t",
    });

    const result = await validateUploadConnectorFileRequest(
      buildRequest({ url: "https://cdn.example.com/a.png", toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST" }),
    );

    expect(result).toEqual({
      url: "https://cdn.example.com/a.png",
      toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST",
    });
  });
});
