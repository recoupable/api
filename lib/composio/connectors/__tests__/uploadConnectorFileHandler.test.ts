import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { uploadConnectorFileHandler } from "../uploadConnectorFileHandler";
import { validateUploadConnectorFileRequest } from "../validateUploadConnectorFileRequest";
import { uploadConnectorFile } from "../uploadConnectorFile";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({})),
}));

vi.mock("../validateUploadConnectorFileRequest", () => ({
  validateUploadConnectorFileRequest: vi.fn(),
}));

vi.mock("../uploadConnectorFile", () => ({
  uploadConnectorFile: vi.fn(),
}));

const buildRequest = () =>
  new NextRequest("http://localhost/api/connectors/files", {
    method: "POST",
    body: JSON.stringify({ url: "https://cdn.example.com/a.png", toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST" }),
  });

describe("uploadConnectorFileHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the flat file descriptor on success", async () => {
    vi.mocked(validateUploadConnectorFileRequest).mockResolvedValue({
      url: "https://cdn.example.com/a.png",
      toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST",
    });
    vi.mocked(uploadConnectorFile).mockResolvedValue({
      name: "a.png",
      mimetype: "image/png",
      s3key: "composio/xyz",
    });

    const response = await uploadConnectorFileHandler(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      name: "a.png",
      mimetype: "image/png",
      s3key: "composio/xyz",
    });
  });

  it("returns the validation/auth error response unchanged", async () => {
    const errorResponse = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateUploadConnectorFileRequest).mockResolvedValue(errorResponse);

    const response = await uploadConnectorFileHandler(buildRequest());

    expect(response).toBe(errorResponse);
    expect(uploadConnectorFile).not.toHaveBeenCalled();
  });

  it("returns 502 when the Composio upload fails", async () => {
    vi.mocked(validateUploadConnectorFileRequest).mockResolvedValue({
      url: "https://cdn.example.com/a.png",
      toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST",
    });
    vi.mocked(uploadConnectorFile).mockRejectedValue(new Error("storage returned HTTP 404"));

    const response = await uploadConnectorFileHandler(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain("storage returned HTTP 404");
  });
});
