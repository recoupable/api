import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

import { registerUpdatePulseTool } from "../registerUpdatePulseTool";

const mockUpsertPulseAccount = vi.fn();
const mockCanAccessAccount = vi.fn();

vi.mock("@/lib/supabase/pulse_accounts/upsertPulseAccount", () => ({
  upsertPulseAccount: (...args: unknown[]) => mockUpsertPulseAccount(...args),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: (...args: unknown[]) => mockCanAccessAccount(...args),
}));

type ServerRequestHandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Creates a mock extra object with optional authInfo.
 *
 * @param authInfo
 * @param authInfo.accountId
 * @param authInfo.orgId
 */
function createMockExtra(authInfo?: {
  accountId?: string;
  orgId?: string | null;
}): ServerRequestHandlerExtra {
  return {
    authInfo: authInfo
      ? {
          token: "test-token",
          scopes: ["mcp:tools"],
          clientId: authInfo.accountId,
          extra: {
            accountId: authInfo.accountId,
            orgId: authInfo.orgId ?? null,
          },
        }
      : undefined,
  } as unknown as ServerRequestHandlerExtra;
}

describe("registerUpdatePulseTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown, extra: ServerRequestHandlerExtra) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerUpdatePulseTool(mockServer);
  });

  it("registers the update_pulse tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "update_pulse",
      expect.objectContaining({
        description: expect.stringContaining("Update the pulse status"),
      }),
      expect.any(Function),
    );
  });

  it("updates pulse with active: true", async () => {
    mockUpsertPulseAccount.mockResolvedValue({
      id: "pulse-456",
      account_id: "account-123",
      active: true,
    });

    const result = await registeredHandler(
      { active: true },
      createMockExtra({ accountId: "account-123" }),
    );

    expect(mockUpsertPulseAccount).toHaveBeenCalledWith({
      account_id: "account-123",
      active: true,
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"active":true'),
        },
      ],
    });
  });

  it("updates pulse with active: false", async () => {
    mockUpsertPulseAccount.mockResolvedValue({
      id: "pulse-456",
      account_id: "account-123",
      active: false,
    });

    const result = await registeredHandler(
      { active: false },
      createMockExtra({ accountId: "account-123" }),
    );

    expect(mockUpsertPulseAccount).toHaveBeenCalledWith({
      account_id: "account-123",
      active: false,
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"active":false'),
        },
      ],
    });
  });

  it("allows account_id override for org auth with access", async () => {
    mockCanAccessAccount.mockResolvedValue(true);
    mockUpsertPulseAccount.mockResolvedValue({
      id: "pulse-456",
      account_id: "target-account-789",
      active: true,
    });

    await registeredHandler(
      { active: true, account_id: "target-account-789" },
      createMockExtra({ accountId: "org-account-id", orgId: "org-account-id" }),
    );

    expect(mockCanAccessAccount).toHaveBeenCalledWith({
      orgId: "org-account-id",
      targetAccountId: "target-account-789",
    });
    expect(mockUpsertPulseAccount).toHaveBeenCalledWith({
      account_id: "target-account-789",
      active: true,
    });
  });

  it("returns error when org auth lacks access to account_id", async () => {
    mockCanAccessAccount.mockResolvedValue(false);

    const result = await registeredHandler(
      { active: true, account_id: "target-account-789" },
      createMockExtra({ accountId: "org-account-id", orgId: "org-account-id" }),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Access denied"),
        },
      ],
    });
  });

  it("returns error when neither auth nor account_id is provided", async () => {
    const result = await registeredHandler({ active: true }, createMockExtra());

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Authentication required"),
        },
      ],
    });
  });

  it("returns error when upsert fails", async () => {
    mockUpsertPulseAccount.mockResolvedValue(null);

    const result = await registeredHandler(
      { active: true },
      createMockExtra({ accountId: "account-123" }),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Failed to update pulse status"),
        },
      ],
    });
  });
});
