import { describe, it, expect, vi, beforeEach } from "vitest";
import { disconnectConnector } from "../disconnectConnector";

import { getConnectors } from "../getConnectors";

vi.mock("../../getComposioApiKey", () => ({
  getComposioApiKey: vi.fn(() => "test-api-key"),
}));

vi.mock("../getConnectors", () => ({
  getConnectors: vi.fn(),
}));

describe("disconnectConnector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("should disconnect connector successfully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
    } as Response);

    const result = await disconnectConnector("ca_12345");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://backend.composio.dev/api/v3/connected_accounts/ca_12345",
      {
        method: "DELETE",
        headers: {
          "x-api-key": "test-api-key",
          "Content-Type": "application/json",
        },
      },
    );
    expect(result).toEqual({ success: true });
  });

  it("should throw when API returns error", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
    } as Response);

    await expect(disconnectConnector("ca_12345")).rejects.toThrow(
      "Failed to disconnect (404): Not found",
    );
  });

  it("should verify ownership before disconnecting when requested", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_12345" },
    ]);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
    } as Response);

    await disconnectConnector("ca_12345", {
      verifyOwnershipFor: "artist-456",
    });

    expect(getConnectors).toHaveBeenCalledWith("artist-456");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("should throw when ownership verification fails", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_different" },
    ]);

    await expect(
      disconnectConnector("ca_12345", {
        verifyOwnershipFor: "artist-456",
      }),
    ).rejects.toThrow("Connection not found for this account");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should throw when account has no connections", async () => {
    vi.mocked(getConnectors).mockResolvedValue([]);

    await expect(
      disconnectConnector("ca_12345", {
        verifyOwnershipFor: "artist-456",
      }),
    ).rejects.toThrow("Connection not found for this account");
  });
});
