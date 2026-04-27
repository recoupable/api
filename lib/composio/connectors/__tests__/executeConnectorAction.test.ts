import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeConnectorAction, ConnectorActionNotFoundError } from "../executeConnectorAction";

import { getComposioClient } from "../../client";

vi.mock("../../client", () => ({
  getComposioClient: vi.fn(),
}));

describe("executeConnectorAction", () => {
  const mockTools = vi.fn();
  const mockSession = { tools: mockTools };
  const mockComposio = { create: vi.fn(() => mockSession) };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getComposioClient).mockResolvedValue(mockComposio);
  });

  it("should call tool.execute with parameters and return result + executedAt", async () => {
    const mockExecute = vi.fn().mockResolvedValue({ rows: 5 });
    mockTools.mockResolvedValue({
      GOOGLESHEETS_WRITE_SPREADSHEET: {
        description: "Write rows",
        execute: mockExecute,
      },
    });

    const result = await executeConnectorAction("account-123", "GOOGLESHEETS_WRITE_SPREADSHEET", {
      sheetId: "abc",
      values: [["a", "b"]],
    });

    expect(mockComposio.create).toHaveBeenCalledWith(
      "account-123",
      expect.objectContaining({
        toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok", "instagram"],
      }),
    );
    expect(mockExecute).toHaveBeenCalledWith({ sheetId: "abc", values: [["a", "b"]] });
    expect(result.result).toEqual({ rows: 5 });
    expect(result.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("should throw ConnectorActionNotFoundError when slug not in tools", async () => {
    mockTools.mockResolvedValue({
      GOOGLESHEETS_WRITE_SPREADSHEET: { execute: vi.fn() },
    });

    await expect(
      executeConnectorAction("account-123", "NOT_A_REAL_SLUG", {}),
    ).rejects.toBeInstanceOf(ConnectorActionNotFoundError);
  });

  it("should throw ConnectorActionNotFoundError when tool has no execute fn", async () => {
    mockTools.mockResolvedValue({
      WEIRD_TOOL: { description: "no execute fn" },
    });

    await expect(executeConnectorAction("account-123", "WEIRD_TOOL", {})).rejects.toBeInstanceOf(
      ConnectorActionNotFoundError,
    );
  });

  it("should propagate errors thrown by tool.execute", async () => {
    const upstreamErr = new Error("Composio upstream failure");
    const mockExecute = vi.fn().mockRejectedValue(upstreamErr);
    mockTools.mockResolvedValue({
      GMAIL_FETCH_EMAILS: { execute: mockExecute },
    });

    await expect(executeConnectorAction("account-123", "GMAIL_FETCH_EMAILS", {})).rejects.toBe(
      upstreamErr,
    );
  });

  it("should pass authConfigs when env vars set", async () => {
    const orig = process.env.COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID;
    process.env.COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID = "ac_sheets_xyz";

    try {
      mockTools.mockResolvedValue({
        GOOGLESHEETS_WRITE_SPREADSHEET: { execute: vi.fn().mockResolvedValue({}) },
      });

      await executeConnectorAction("account-123", "GOOGLESHEETS_WRITE_SPREADSHEET", {});

      expect(mockComposio.create).toHaveBeenCalledWith(
        "account-123",
        expect.objectContaining({
          authConfigs: expect.objectContaining({ googlesheets: "ac_sheets_xyz" }),
        }),
      );
    } finally {
      if (orig === undefined) delete process.env.COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID;
      else process.env.COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID = orig;
    }
  });
});
