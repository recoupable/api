import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeConnectorAction } from "../executeConnectorAction";
import { ConnectorActionNotFoundError } from "../connectorActionErrors";

import { getComposioTools } from "../../toolRouter/getTools";

vi.mock("../../toolRouter/getTools", () => ({
  getComposioTools: vi.fn(),
}));

describe("executeConnectorAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call tool.execute with parameters and return result + executedAt", async () => {
    const mockExecute = vi.fn().mockResolvedValue({ rows: 5 });
    vi.mocked(getComposioTools).mockResolvedValue({
      GOOGLESHEETS_WRITE_SPREADSHEET: {
        description: "Write rows",
        inputSchema: {},
        execute: mockExecute,
      },
    });

    const result = await executeConnectorAction("account-123", "GOOGLESHEETS_WRITE_SPREADSHEET", {
      sheetId: "abc",
      values: [["a", "b"]],
    });

    expect(getComposioTools).toHaveBeenCalledWith("account-123");
    expect(mockExecute).toHaveBeenCalledWith({ sheetId: "abc", values: [["a", "b"]] });
    expect(result.result).toEqual({ rows: 5 });
    expect(result.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("should throw ConnectorActionNotFoundError when slug not in tools", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      GOOGLESHEETS_WRITE_SPREADSHEET: { execute: vi.fn(), inputSchema: {} },
    });

    await expect(
      executeConnectorAction("account-123", "NOT_A_REAL_SLUG", {}),
    ).rejects.toBeInstanceOf(ConnectorActionNotFoundError);
  });

  it("should throw ConnectorActionNotFoundError when tool has no execute fn", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      WEIRD_TOOL: { description: "no execute fn", inputSchema: {} } as never,
    });

    await expect(executeConnectorAction("account-123", "WEIRD_TOOL", {})).rejects.toBeInstanceOf(
      ConnectorActionNotFoundError,
    );
  });

  it("should propagate errors thrown by tool.execute", async () => {
    const upstreamErr = new Error("Composio upstream failure");
    const mockExecute = vi.fn().mockRejectedValue(upstreamErr);
    vi.mocked(getComposioTools).mockResolvedValue({
      GMAIL_FETCH_EMAILS: { execute: mockExecute, inputSchema: {} },
    });

    await expect(executeConnectorAction("account-123", "GMAIL_FETCH_EMAILS", {})).rejects.toBe(
      upstreamErr,
    );
  });

  it("returns 404 when getComposioTools returns empty", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({});

    await expect(
      executeConnectorAction("account-123", "GOOGLEDOCS_INSERT_TEXT_ACTION", {}),
    ).rejects.toBeInstanceOf(ConnectorActionNotFoundError);
  });
});
