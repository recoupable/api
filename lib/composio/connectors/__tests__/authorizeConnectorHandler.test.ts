import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { authorizeConnectorHandler } from "../authorizeConnectorHandler";

import { validateAuthorizeConnectorRequest } from "../validateAuthorizeConnectorRequest";
import { authorizeConnector } from "../authorizeConnector";

vi.mock("../validateAuthorizeConnectorRequest", () => ({
  validateAuthorizeConnectorRequest: vi.fn(),
}));

vi.mock("../authorizeConnector", () => ({
  authorizeConnector: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

describe("authorizeConnectorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return validation error if validation fails", async () => {
    vi.mocked(validateAuthorizeConnectorRequest).mockResolvedValue(
      NextResponse.json({ error: "Invalid request" }, { status: 400 }),
    );

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "POST",
    });
    const result = await authorizeConnectorHandler(request);

    expect(result.status).toBe(400);
  });

  it("should call authorizeConnector with validated params for account connection", async () => {
    vi.mocked(validateAuthorizeConnectorRequest).mockResolvedValue({
      accountId: "account-123",
      connector: "googlesheets",
    });
    vi.mocked(authorizeConnector).mockResolvedValue({
      connector: "googlesheets",
      redirectUrl: "https://oauth.example.com/auth",
    });

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "POST",
    });
    const result = await authorizeConnectorHandler(request);

    expect(authorizeConnector).toHaveBeenCalledWith("account-123", "googlesheets", {
      customCallbackUrl: undefined,
      authConfigs: undefined,
    });
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.success).toBe(true);
    expect(body.data.redirectUrl).toBe("https://oauth.example.com/auth");
  });

  it("should call authorizeConnector with authConfigs for account with authConfigs", async () => {
    vi.mocked(validateAuthorizeConnectorRequest).mockResolvedValue({
      accountId: "account-456",
      connector: "tiktok",
      authConfigs: { tiktok: "ac_123" },
    });
    vi.mocked(authorizeConnector).mockResolvedValue({
      connector: "tiktok",
      redirectUrl: "https://oauth.example.com/auth",
    });

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "POST",
    });
    await authorizeConnectorHandler(request);

    expect(authorizeConnector).toHaveBeenCalledWith("account-456", "tiktok", {
      customCallbackUrl: undefined,
      authConfigs: { tiktok: "ac_123" },
    });
  });

  it("should pass through custom callbackUrl", async () => {
    vi.mocked(validateAuthorizeConnectorRequest).mockResolvedValue({
      accountId: "account-123",
      connector: "googlesheets",
      callbackUrl: "https://custom.example.com/callback",
    });
    vi.mocked(authorizeConnector).mockResolvedValue({
      connector: "googlesheets",
      redirectUrl: "https://oauth.example.com/auth",
    });

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "POST",
    });
    await authorizeConnectorHandler(request);

    expect(authorizeConnector).toHaveBeenCalledWith("account-123", "googlesheets", {
      customCallbackUrl: "https://custom.example.com/callback",
      authConfigs: undefined,
    });
  });

  it("should return 500 on error", async () => {
    vi.mocked(validateAuthorizeConnectorRequest).mockResolvedValue({
      accountId: "account-123",
      connector: "googlesheets",
    });
    vi.mocked(authorizeConnector).mockRejectedValue(new Error("OAuth failed"));

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "POST",
    });
    const result = await authorizeConnectorHandler(request);

    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe("OAuth failed");
  });
});
