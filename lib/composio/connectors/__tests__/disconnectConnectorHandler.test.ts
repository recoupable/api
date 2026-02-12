import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { disconnectConnectorHandler } from "../disconnectConnectorHandler";

import { validateDisconnectConnectorRequest } from "../validateDisconnectConnectorRequest";
import { disconnectConnector } from "../disconnectConnector";

vi.mock("../validateDisconnectConnectorRequest", () => ({
  validateDisconnectConnectorRequest: vi.fn(),
}));

vi.mock("../disconnectConnector", () => ({
  disconnectConnector: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

describe("disconnectConnectorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return validation error if validation fails", async () => {
    vi.mocked(validateDisconnectConnectorRequest).mockResolvedValue(
      NextResponse.json({ error: "Invalid request" }, { status: 400 }),
    );

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
    });
    const result = await disconnectConnectorHandler(request);

    expect(result.status).toBe(400);
  });

  it("should call disconnectConnector without options when no targetAccountId", async () => {
    vi.mocked(validateDisconnectConnectorRequest).mockResolvedValue({
      connectedAccountId: "ca_123",
    });
    vi.mocked(disconnectConnector).mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
    });
    const result = await disconnectConnectorHandler(request);

    expect(disconnectConnector).toHaveBeenCalledWith("ca_123");
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.success).toBe(true);
  });

  it("should call disconnectConnector with verifyOwnershipFor when targetAccountId provided", async () => {
    vi.mocked(validateDisconnectConnectorRequest).mockResolvedValue({
      connectedAccountId: "ca_123",
      targetAccountId: "account-456",
    });
    vi.mocked(disconnectConnector).mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
    });
    const result = await disconnectConnectorHandler(request);

    expect(disconnectConnector).toHaveBeenCalledWith("ca_123", {
      verifyOwnershipFor: "account-456",
    });
    expect(result.status).toBe(200);
  });

  it("should return 500 on error", async () => {
    vi.mocked(validateDisconnectConnectorRequest).mockResolvedValue({
      connectedAccountId: "ca_123",
    });
    vi.mocked(disconnectConnector).mockRejectedValue(new Error("Disconnect failed"));

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
    });
    const result = await disconnectConnectorHandler(request);

    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe("Disconnect failed");
  });
});
