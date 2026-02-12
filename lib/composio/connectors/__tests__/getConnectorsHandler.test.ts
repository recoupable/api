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
      accountId: "account-123",
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
    expect(body.connectors).toHaveLength(2);
    expect(body.connectors[0].slug).toBe("googlesheets");
  });

  it("should fetch all connectors for any account (no filtering)", async () => {
    vi.mocked(validateGetConnectorsRequest).mockResolvedValue({
      accountId: "account-456",
    });

    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "tiktok", name: "TikTok", isConnected: true },
    ]);

    const request = new NextRequest(
      "http://localhost/api/connectors?account_id=account-456",
    );
    await getConnectorsHandler(request);

    // API is unopinionated — no allowedToolkits filtering
    expect(getConnectors).toHaveBeenCalledWith("account-456", {
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
      accountId: "account-123",
    });

    vi.mocked(getConnectors).mockRejectedValue(new Error("Composio API error"));

    const request = new NextRequest("http://localhost/api/connectors");
    const result = await getConnectorsHandler(request);
    const body = await result.json();

    expect(result.status).toBe(500);
    expect(body.error).toBe("Composio API error");
  });
});
