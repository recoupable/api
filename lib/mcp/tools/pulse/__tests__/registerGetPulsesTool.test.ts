import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

import { registerGetPulsesTool } from "../registerGetPulsesTool";

const mockSelectPulseAccounts = vi.fn();
const mockCanAccessAccount = vi.fn();

vi.mock("@/lib/supabase/pulse_accounts/selectPulseAccounts", () => ({
  selectPulseAccounts: (...args: unknown[]) => mockSelectPulseAccounts(...args),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: (...args: unknown[]) => mockCanAccessAccount(...args),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-org-id",
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

describe("registerGetPulsesTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown, extra: ServerRequestHandlerExtra) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerGetPulsesTool(mockServer);
  });

  it("registers the get_pulses tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "get_pulses",
      expect.objectContaining({
        description: "Get pulse statuses for accounts.",
      }),
      expect.any(Function),
    );
  });

  it("returns empty pulses array when no records exist", async () => {
    mockSelectPulseAccounts.mockResolvedValue([]);

    const result = await registeredHandler({}, createMockExtra({ accountId: "account-123" }));

    expect(mockSelectPulseAccounts).toHaveBeenCalledWith({ accountIds: ["account-123"] });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"pulses":[]'),
        },
      ],
    });
  });

  it("returns pulses array with records when they exist", async () => {
    mockSelectPulseAccounts.mockResolvedValue([
      {
        id: "pulse-456",
        account_id: "account-123",
        active: true,
      },
    ]);

    const result = await registeredHandler({}, createMockExtra({ accountId: "account-123" }));

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"pulses":['),
        },
      ],
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

  it("allows account_id override for org auth with access", async () => {
    mockCanAccessAccount.mockResolvedValue(true);
    mockSelectPulseAccounts.mockResolvedValue([
      {
        id: "pulse-456",
        account_id: "target-account-789",
        active: true,
      },
    ]);

    await registeredHandler(
      { account_id: "target-account-789" },
      createMockExtra({ accountId: "org-account-id", orgId: "org-account-id" }),
    );

    expect(mockCanAccessAccount).toHaveBeenCalledWith({
      orgId: "org-account-id",
      targetAccountId: "target-account-789",
    });
    expect(mockSelectPulseAccounts).toHaveBeenCalledWith({ accountIds: ["target-account-789"] });
  });

  it("returns error when org auth lacks access to account_id", async () => {
    mockCanAccessAccount.mockResolvedValue(false);

    const result = await registeredHandler(
      { account_id: "target-account-789" },
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
    const result = await registeredHandler({}, createMockExtra());

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Authentication required"),
        },
      ],
    });
  });

  it("returns ALL pulses for Recoup Admin key (no filter)", async () => {
    const allPulses = [
      { id: "pulse-1", account_id: "account-1", active: true },
      { id: "pulse-2", account_id: "account-2", active: false },
      { id: "pulse-3", account_id: "account-3", active: true },
    ];
    mockSelectPulseAccounts.mockResolvedValue(allPulses);

    const result = await registeredHandler(
      {},
      createMockExtra({ accountId: "recoup-org-id", orgId: "recoup-org-id" }),
    );

    // Should call selectPulseAccounts with empty object (no filter)
    expect(mockSelectPulseAccounts).toHaveBeenCalledWith({});
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"pulses":['),
        },
      ],
    });
  });

  it("returns pulses filtered by orgId for org key", async () => {
    const orgPulses = [
      { id: "pulse-1", account_id: "member-1", active: true },
      { id: "pulse-2", account_id: "member-2", active: false },
    ];
    mockSelectPulseAccounts.mockResolvedValue(orgPulses);

    const result = await registeredHandler(
      {},
      createMockExtra({ accountId: "org-123", orgId: "org-123" }),
    );

    // Should call selectPulseAccounts with orgId filter
    expect(mockSelectPulseAccounts).toHaveBeenCalledWith({ orgId: "org-123" });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"pulses":['),
        },
      ],
    });
  });
});
