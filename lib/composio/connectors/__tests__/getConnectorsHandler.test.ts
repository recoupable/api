import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getConnectorsHandler } from "../getConnectorsHandler";

import { validateGetConnectorsRequest } from "../validateGetConnectorsRequest";
import { getConnectors } from "../getConnectors";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

vi.mock("../validateGetConnectorsRequest", () => ({
  validateGetConnectorsRequest: vi.fn(),
}));

vi.mock("../getConnectors", () => ({
  getConnectors: vi.fn(),
}));

describe("getConnectorsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return validation error when request validation fails", async () => {
    vi.mocked(validateGetConnectorsRequest).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/connectors");
    const result = await getConnectorsHandler(request);

    expect(result.status).toBe(401);
  });

  it("should return connectors list for account", async () => {
    vi.mocked(validateGetConnectorsRequest).mockResolvedValue({
      composioEntityId: "account-123",
    });

    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "googlesheets", name: "Google Sheets", isConnected: true },
      { slug: "googledrive", name: "Google Drive", isConnected: false },
    ]);

    const request = new NextRequest("http://localhost/api/connectors");
    const result = await getConnectorsHandler(request);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.connectors).toHaveLength(2);
    expect(body.data.connectors[0].slug).toBe("googlesheets");
  });

  it("should pass allowedToolkits when account_id is provided", async () => {
    vi.mocked(validateGetConnectorsRequest).mockResolvedValue({
      composioEntityId: "entity-456",
      allowedToolkits: ["tiktok"],
    });

    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "tiktok", name: "TikTok", isConnected: true },
    ]);

    const request = new NextRequest(
      "http://localhost/api/connectors?account_id=entity-456",
    );
    await getConnectorsHandler(request);

    expect(getConnectors).toHaveBeenCalledWith("entity-456", {
      allowedToolkits: ["tiktok"],
      displayNames: {
        tiktok: "TikTok",
        googlesheets: "Google Sheets",
        googledrive: "Google Drive",
        googledocs: "Google Docs",
      },
    });
  });

  it("should return 500 when getConnectors throws", async () => {
    vi.mocked(validateGetConnectorsRequest).mockResolvedValue({
      composioEntityId: "account-123",
    });

    vi.mocked(getConnectors).mockRejectedValue(new Error("Composio API error"));

    const request = new NextRequest("http://localhost/api/connectors");
    const result = await getConnectorsHandler(request);
    const body = await result.json();

    expect(result.status).toBe(500);
    expect(body.error).toBe("Composio API error");
  });
});
