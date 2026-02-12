import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizeConnector } from "../authorizeConnector";

import { getComposioClient } from "../../client";
import { getCallbackUrl } from "../../getCallbackUrl";

vi.mock("../../client", () => ({
  getComposioClient: vi.fn(),
}));

vi.mock("../../getCallbackUrl", () => ({
  getCallbackUrl: vi.fn(() => "https://app.example.com/settings/connectors?connected=true"),
}));

describe("authorizeConnector", () => {
  const mockAuthorize = vi.fn();
  const mockCreate = vi.fn();
  const mockClient = {
    create: mockCreate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ authorize: mockAuthorize });
    mockAuthorize.mockResolvedValue({ redirectUrl: "https://oauth.example.com/auth" });
    vi.mocked(getComposioClient).mockResolvedValue(mockClient as never);
  });

  it("should generate OAuth URL for connector", async () => {
    const result = await authorizeConnector("account-123", "googlesheets");

    expect(mockCreate).toHaveBeenCalledWith("account-123", {
      manageConnections: {
        callbackUrl: "https://app.example.com/settings/connectors?connected=true",
      },
    });
    expect(mockAuthorize).toHaveBeenCalledWith("googlesheets");
    expect(result).toEqual({
      connector: "googlesheets",
      redirectUrl: "https://oauth.example.com/auth",
    });
  });

  it("should use connectors destination by default", async () => {
    await authorizeConnector("account-123", "googlesheets");

    expect(getCallbackUrl).toHaveBeenCalledWith({ destination: "connectors" });
  });

  it("should use custom callback URL when provided", async () => {
    const customUrl = "https://custom.example.com/callback";
    await authorizeConnector("account-123", "googlesheets", { customCallbackUrl: customUrl });

    expect(mockCreate).toHaveBeenCalledWith("account-123", {
      manageConnections: {
        callbackUrl: customUrl,
      },
    });
    // getCallbackUrl should not be called when custom URL is provided
    expect(getCallbackUrl).not.toHaveBeenCalled();
  });

  it("should include auth configs when provided", async () => {
    const authConfigs = { tiktok: "ac_12345" };
    await authorizeConnector("account-456", "tiktok", { authConfigs });

    expect(mockCreate).toHaveBeenCalledWith("account-456", {
      authConfigs,
      manageConnections: {
        callbackUrl: "https://app.example.com/settings/connectors?connected=true",
      },
    });
  });

  it("should not include authConfigs if empty object", async () => {
    await authorizeConnector("account-123", "googlesheets", { authConfigs: {} });

    expect(mockCreate).toHaveBeenCalledWith("account-123", {
      manageConnections: {
        callbackUrl: "https://app.example.com/settings/connectors?connected=true",
      },
    });
  });
});
