import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { validateUploadConnectorFileBody } from "../validateUploadConnectorFileBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({})),
}));

describe("validateUploadConnectorFileBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the validated body for a valid url + toolSlug", () => {
    const result = validateUploadConnectorFileBody({
      url: "https://cdn.example.com/post.png",
      toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST",
    });
    expect(result).toEqual({
      url: "https://cdn.example.com/post.png",
      toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST",
    });
  });

  it("returns 400 when url is missing", () => {
    const result = validateUploadConnectorFileBody({ toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST" });
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) expect(result.status).toBe(400);
  });

  it("returns 400 when url is not a valid URL", () => {
    const result = validateUploadConnectorFileBody({
      url: "not-a-url",
      toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST",
    });
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) expect(result.status).toBe(400);
  });

  it("returns 400 when toolSlug is missing", () => {
    const result = validateUploadConnectorFileBody({ url: "https://cdn.example.com/post.png" });
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) expect(result.status).toBe(400);
  });
});
