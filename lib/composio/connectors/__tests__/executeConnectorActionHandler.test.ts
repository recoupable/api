import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { executeConnectorActionHandler } from "../executeConnectorActionHandler";

import { validateExecuteConnectorActionRequest } from "../validateExecuteConnectorActionRequest";
import { executeConnectorAction } from "../executeConnectorAction";
import { ConnectorActionNotFoundError } from "../connectorActionErrors";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

vi.mock("../validateExecuteConnectorActionRequest", () => ({
  validateExecuteConnectorActionRequest: vi.fn(),
}));

vi.mock("../executeConnectorAction", () => ({
  executeConnectorAction: vi.fn(),
}));

const buildRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/connectors/actions", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("executeConnectorActionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return validation error when request validation fails", async () => {
    vi.mocked(validateExecuteConnectorActionRequest).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const result = await executeConnectorActionHandler(buildRequest({}));

    expect(result.status).toBe(401);
  });

  it("should return 200 with success: true and flat shape on execute", async () => {
    vi.mocked(validateExecuteConnectorActionRequest).mockResolvedValue({
      accountId: "account-123",
      actionSlug: "GMAIL_FETCH_EMAILS",
      parameters: { max_results: 5 },
    });
    vi.mocked(executeConnectorAction).mockResolvedValue({
      result: { messages: ["a", "b"] },
      executedAt: "2026-04-27T01:00:00.000Z",
    });

    const result = await executeConnectorActionHandler(
      buildRequest({ actionSlug: "GMAIL_FETCH_EMAILS", parameters: { max_results: 5 } }),
    );
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result).toEqual({ messages: ["a", "b"] });
    expect(body.executedAt).toBe("2026-04-27T01:00:00.000Z");
    expect(body.data).toBeUndefined();
  });

  it("should call executeConnectorAction with validated params", async () => {
    vi.mocked(validateExecuteConnectorActionRequest).mockResolvedValue({
      accountId: "account-456",
      actionSlug: "GOOGLESHEETS_WRITE_SPREADSHEET",
      parameters: { sheetId: "abc" },
    });
    vi.mocked(executeConnectorAction).mockResolvedValue({
      result: {},
      executedAt: "2026-04-27T01:00:00.000Z",
    });

    await executeConnectorActionHandler(
      buildRequest({
        actionSlug: "GOOGLESHEETS_WRITE_SPREADSHEET",
        parameters: { sheetId: "abc" },
      }),
    );

    expect(executeConnectorAction).toHaveBeenCalledWith(
      "account-456",
      "GOOGLESHEETS_WRITE_SPREADSHEET",
      {
        sheetId: "abc",
      },
    );
  });

  it("should return 404 when executeConnectorAction throws ConnectorActionNotFoundError", async () => {
    vi.mocked(validateExecuteConnectorActionRequest).mockResolvedValue({
      accountId: "account-123",
      actionSlug: "UNKNOWN",
      parameters: {},
    });
    vi.mocked(executeConnectorAction).mockRejectedValue(
      new ConnectorActionNotFoundError("UNKNOWN"),
    );

    const result = await executeConnectorActionHandler(
      buildRequest({ actionSlug: "UNKNOWN", parameters: {} }),
    );
    const body = await result.json();

    expect(result.status).toBe(404);
    expect(body.error).toContain("UNKNOWN");
  });

  it("should return 500 when executeConnectorAction throws generic error", async () => {
    vi.mocked(validateExecuteConnectorActionRequest).mockResolvedValue({
      accountId: "account-123",
      actionSlug: "GMAIL_FETCH_EMAILS",
      parameters: {},
    });
    vi.mocked(executeConnectorAction).mockRejectedValue(new Error("Composio upstream"));

    const result = await executeConnectorActionHandler(
      buildRequest({ actionSlug: "GMAIL_FETCH_EMAILS", parameters: {} }),
    );
    const body = await result.json();

    expect(result.status).toBe(500);
    expect(body.error).toBe("Composio upstream");
  });
});
