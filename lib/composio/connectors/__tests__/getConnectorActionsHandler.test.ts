import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getConnectorActionsHandler } from "../getConnectorActionsHandler";

import { validateGetConnectorActionsRequest } from "../validateGetConnectorActionsRequest";
import { getConnectorActions } from "../getConnectorActions";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

vi.mock("../validateGetConnectorActionsRequest", () => ({
  validateGetConnectorActionsRequest: vi.fn(),
}));

vi.mock("../getConnectorActions", () => ({
  getConnectorActions: vi.fn(),
}));

describe("getConnectorActionsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return validation error when request validation fails", async () => {
    vi.mocked(validateGetConnectorActionsRequest).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/connectors/actions");
    const result = await getConnectorActionsHandler(request);

    expect(result.status).toBe(401);
  });

  it("should return actions list with success: true and flat shape", async () => {
    vi.mocked(validateGetConnectorActionsRequest).mockResolvedValue({
      accountId: "account-123",
    });
    vi.mocked(getConnectorActions).mockResolvedValue([
      {
        slug: "GMAIL_FETCH_EMAILS",
        name: "GMAIL_FETCH_EMAILS",
        description: "Fetch emails",
        parameters: { type: "object" },
        connectorSlug: "gmail",
        isConnected: true,
      },
    ]);

    const request = new NextRequest("http://localhost/api/connectors/actions");
    const result = await getConnectorActionsHandler(request);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].slug).toBe("GMAIL_FETCH_EMAILS");
    expect(body.data).toBeUndefined();
  });

  it("should call getConnectorActions with the validated accountId", async () => {
    vi.mocked(validateGetConnectorActionsRequest).mockResolvedValue({
      accountId: "account-target-456",
    });
    vi.mocked(getConnectorActions).mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/connectors/actions?account_id=account-target-456",
    );
    await getConnectorActionsHandler(request);

    expect(getConnectorActions).toHaveBeenCalledWith("account-target-456");
  });

  it("should return 500 when getConnectorActions throws", async () => {
    vi.mocked(validateGetConnectorActionsRequest).mockResolvedValue({
      accountId: "account-123",
    });
    vi.mocked(getConnectorActions).mockRejectedValue(new Error("Composio API error"));

    const request = new NextRequest("http://localhost/api/connectors/actions");
    const result = await getConnectorActionsHandler(request);
    const body = await result.json();

    expect(result.status).toBe(500);
    expect(body.error).toBe("Composio API error");
  });
});
