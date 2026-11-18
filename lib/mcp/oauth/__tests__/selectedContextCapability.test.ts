import { expect, it, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";

vi.mock("../../tools", () => ({
  registerAllTools: (server: McpServer) => {
    server.registerTool(
      "context",
      {
        inputSchema: z.discriminatedUnion("action", [
          z.object({ action: z.literal("read") }),
          z.object({ action: z.literal("future_action") }),
        ]),
      },
      async () => ({ content: [] }),
    );
  },
}));
vi.mock("../contextToolOperations", () => ({
  contextToolOperations: {
    read: {
      name: "read_music_context",
      description: "Read",
      readOnly: true,
      destructive: false,
      openWorld: false,
    },
    future_action: {
      name: "future_context",
      description: "New capability",
      readOnly: false,
      destructive: false,
      openWorld: false,
    },
  },
}));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/context/authorizeContextOwner", () => ({
  authorizeContextOwner: vi.fn(async (accountId: string) => ({
    accountId,
    ownerId: accountId,
    organizationId: null,
  })),
}));

it("does not expand v1 after refresh or registry recreation when Context adds an action", async () => {
  const accountId = "11111111-1111-4111-8111-111111111111";
  const selectedContext = {
    version: 1 as const,
    capabilityVersion: "context-workspace-v1" as const,
    mode: "selected_context" as const,
    kind: "personal" as const,
    ownerId: accountId,
    organizationId: null,
  };
  const access = {
    accountId,
    clientId: "client",
    grantId: "grant",
    scopes: ["mcp:tools"],
    expiresAt: 9999999999,
    resource: "https://api.example/mcp",
    context: "personal" as const,
    selectedContext,
  };
  const verify = vi.fn().mockResolvedValue(access);
  const services = {
    prepare: vi.fn(async (_name: string, args: Record<string, unknown>) => args),
    listArtists: vi.fn(),
  };
  for (const token of ["initial-token", "rotated-token"]) {
    const registered = new Map<string, { run: any }>();
    const server = {
      registerTool: (name: string, _config: unknown, run: unknown) => registered.set(name, { run }),
    } as unknown as McpServer;
    registerFullOAuthTools(server, verify, services, "selected_context");
    expect([...registered.keys()]).toEqual(["read_music_context"]);
    const extra = {
      authInfo: {
        token,
        clientId: access.clientId,
        scopes: access.scopes,
        extra: { accountId, oauth: access },
      },
    };
    expect((await registered.get("read_music_context")!.run({}, extra)).isError).not.toBe(true);
    verify.mockResolvedValueOnce({
      ...access,
      selectedContext: { ...selectedContext, capabilityVersion: "future-version" },
    });
    expect((await registered.get("read_music_context")!.run({}, extra)).isError).toBe(true);
  }
});
