import { describe, it, expect, vi, beforeEach } from "vitest";

import { executeConnectorAction } from "../executeConnectorAction";
import { ConnectorActionNotFoundError } from "../connectorActionErrors";
import { getComposioTools } from "../../toolRouter/getTools";

vi.mock("../../toolRouter/getTools", () => ({ getComposioTools: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeConnectorAction", () => {
  it("unwraps Composio's ToolExecuteResponse envelope", async () => {
    const exec = vi.fn().mockResolvedValue({ successful: true, data: { rows: 5 }, error: null });
    vi.mocked(getComposioTools).mockResolvedValue({
      GOOGLESHEETS_WRITE_SPREADSHEET: { execute: exec, inputSchema: {} },
    });

    const result = await executeConnectorAction(
      "artist-account",
      "GOOGLESHEETS_WRITE_SPREADSHEET",
      { sheetId: "abc" },
    );

    expect(getComposioTools).toHaveBeenCalledWith("artist-account");
    expect(exec).toHaveBeenCalledWith({ sheetId: "abc" });
    expect(result.result).toEqual({ rows: 5 });
    expect(result.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("throws when Composio reports successful: false", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      YOUTUBE_GET_CHANNEL_STATISTICS: {
        execute: vi
          .fn()
          .mockResolvedValue({ successful: false, data: null, error: "quota exceeded" }),
        inputSchema: {},
      },
    });

    await expect(
      executeConnectorAction("artist", "YOUTUBE_GET_CHANNEL_STATISTICS", { mine: true }),
    ).rejects.toThrow(/quota exceeded/);
  });

  it("passes through results not wrapped in the envelope", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      LEGACY_TOOL: { execute: vi.fn().mockResolvedValue({ rows: 5 }), inputSchema: {} },
    });

    const result = await executeConnectorAction("artist", "LEGACY_TOOL", {});

    expect(result.result).toEqual({ rows: 5 });
  });

  it("throws ConnectorActionNotFoundError when slug not in tools", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      GOOGLESHEETS_WRITE_SPREADSHEET: { execute: vi.fn(), inputSchema: {} },
    });

    await expect(executeConnectorAction("artist", "NOT_A_REAL_SLUG", {})).rejects.toBeInstanceOf(
      ConnectorActionNotFoundError,
    );
  });

  it("throws ConnectorActionNotFoundError when tool has no execute fn", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      WEIRD_TOOL: { description: "no execute", inputSchema: {} } as never,
    });

    await expect(executeConnectorAction("artist", "WEIRD_TOOL", {})).rejects.toBeInstanceOf(
      ConnectorActionNotFoundError,
    );
  });

  it("propagates errors thrown by tool.execute", async () => {
    const err = new Error("upstream failure");
    vi.mocked(getComposioTools).mockResolvedValue({
      GMAIL_FETCH_EMAILS: { execute: vi.fn().mockRejectedValue(err), inputSchema: {} },
    });

    await expect(executeConnectorAction("artist", "GMAIL_FETCH_EMAILS", {})).rejects.toBe(err);
  });

  it("throws ConnectorActionNotFoundError when getComposioTools returns empty", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({});

    await expect(
      executeConnectorAction("artist", "GOOGLEDOCS_INSERT_TEXT_ACTION", {}),
    ).rejects.toBeInstanceOf(ConnectorActionNotFoundError);
  });
});
