import { describe, it, expect, vi, beforeEach } from "vitest";

import { executeConnectorAction } from "../executeConnectorAction";
import { ConnectorActionNotFoundError } from "../connectorActionErrors";
import { getComposioClient } from "../../client";

vi.mock("../../client", () => ({ getComposioClient: vi.fn() }));
vi.mock("../../toolRouter/getTools", () => ({ ENABLED_TOOLKITS: ["youtube"] }));

const mockToolsGet = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getComposioClient).mockResolvedValue({
    tools: { get: mockToolsGet },
  } as never);
});

describe("executeConnectorAction", () => {
  it("unwraps Composio's ToolExecuteResponse envelope", async () => {
    const exec = vi.fn().mockResolvedValue({ successful: true, data: { rows: 5 }, error: null });
    mockToolsGet.mockResolvedValue({
      GOOGLESHEETS_WRITE_SPREADSHEET: { execute: exec },
    });

    const result = await executeConnectorAction(
      "artist-account",
      "GOOGLESHEETS_WRITE_SPREADSHEET",
      {
        sheetId: "abc",
      },
    );

    expect(mockToolsGet).toHaveBeenCalledWith(
      "artist-account",
      expect.objectContaining({ toolkits: expect.any(Array) }),
    );
    expect(exec).toHaveBeenCalledWith({ sheetId: "abc" });
    expect(result.result).toEqual({ rows: 5 });
    expect(result.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("throws when Composio reports successful: false", async () => {
    mockToolsGet.mockResolvedValue({
      YOUTUBE_GET_CHANNEL_STATISTICS: {
        execute: vi
          .fn()
          .mockResolvedValue({ successful: false, data: null, error: "quota exceeded" }),
      },
    });

    await expect(
      executeConnectorAction("artist", "YOUTUBE_GET_CHANNEL_STATISTICS", { mine: true }),
    ).rejects.toThrow(/quota exceeded/);
  });

  it("passes through results not wrapped in the envelope", async () => {
    mockToolsGet.mockResolvedValue({
      LEGACY_TOOL: { execute: vi.fn().mockResolvedValue({ rows: 5 }) },
    });

    const result = await executeConnectorAction("artist", "LEGACY_TOOL", {});

    expect(result.result).toEqual({ rows: 5 });
  });

  it("throws ConnectorActionNotFoundError when slug not in tools", async () => {
    mockToolsGet.mockResolvedValue({
      GOOGLESHEETS_WRITE_SPREADSHEET: { execute: vi.fn() },
    });

    await expect(executeConnectorAction("artist", "NOT_A_REAL_SLUG", {})).rejects.toBeInstanceOf(
      ConnectorActionNotFoundError,
    );
  });

  it("throws ConnectorActionNotFoundError when tool has no execute fn", async () => {
    mockToolsGet.mockResolvedValue({ WEIRD_TOOL: { description: "no execute" } });

    await expect(executeConnectorAction("artist", "WEIRD_TOOL", {})).rejects.toBeInstanceOf(
      ConnectorActionNotFoundError,
    );
  });

  it("propagates errors thrown by tool.execute", async () => {
    const err = new Error("upstream failure");
    mockToolsGet.mockResolvedValue({
      GMAIL_FETCH_EMAILS: { execute: vi.fn().mockRejectedValue(err) },
    });

    await expect(executeConnectorAction("artist", "GMAIL_FETCH_EMAILS", {})).rejects.toBe(err);
  });

  it("throws ConnectorActionNotFoundError when no tools are returned", async () => {
    mockToolsGet.mockResolvedValue({});

    await expect(
      executeConnectorAction("artist", "GOOGLEDOCS_INSERT_TEXT_ACTION", {}),
    ).rejects.toBeInstanceOf(ConnectorActionNotFoundError);
  });
});
