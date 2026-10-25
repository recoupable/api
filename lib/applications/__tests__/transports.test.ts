import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { POST } from "@/app/api/applications/registration/validate/route";
import { registerValidateApplicationRegistrationTool } from "@/lib/mcp/tools/applications/registerValidateApplicationRegistrationTool";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));
const accountId = "11111111-1111-4111-8111-111111111111";
const input = {
  name: "External app",
  environment: "production",
  allowed_origins: ["https://artist.example"],
  return_urls: ["https://artist.example/callback"],
};
const request = (body: unknown) =>
  new NextRequest("https://api.example/api/applications/registration/validate", {
    method: "POST",
    headers: { Authorization: "Bearer synthetic", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "synthetic",
  });
  vi.mocked(resolveAccountId).mockResolvedValue({ accountId, error: null });
});
it("authenticates HTTP before parsing any proposal", async () => {
  vi.mocked(validateAuthContext).mockResolvedValue(
    NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  );
  expect((await POST(request(null))).status).toBe(401);
  expect(validateOrganizationAccess).not.toHaveBeenCalled();
});
it("returns matching HTTP and SDK MCP preflight contracts", async () => {
  const http = await POST(request(input));
  expect(http.status).toBe(200);
  expect(http.headers.get("cache-control")).toBe("private, no-store");
  const expected = await http.json();
  const server = new McpServer({ name: "registration-test", version: "1" });
  registerValidateApplicationRegistrationTool(server);
  const client = new Client({ name: "test-client", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    const { tools } = await client.listTools();
    expect(tools[0].annotations?.readOnlyHint).toBe(true);
    expect(tools[0].inputSchema.properties).not.toHaveProperty("account_id");
    const result = await client.callTool({
      name: "validate_application_registration",
      arguments: input,
    });
    expect(result.isError).not.toBe(true);
    const content = result.content as Array<{ text: string }>;
    expect(JSON.parse(content[0].text)).toEqual(expected);
    vi.mocked(resolveAccountId).mockResolvedValue({ accountId: null, error: "no auth" });
    expect(
      (await client.callTool({ name: "validate_application_registration", arguments: input }))
        .isError,
    ).toBe(true);
  } finally {
    await client.close();
    await server.close();
  }
});
it("returns 400 for malformed bodies and credentials in the input", async () => {
  expect((await POST(request(null))).status).toBe(400);
  expect((await POST(request({ ...input, client_secret: "not-accepted" }))).status).toBe(400);
});
it("returns 403 for another workspace and sanitizes infrastructure failures", async () => {
  const other = { ...input, organization_id: "22222222-2222-4222-8222-222222222222" };
  vi.mocked(validateOrganizationAccess).mockResolvedValue(false);
  expect((await POST(request(other))).status).toBe(403);
  vi.mocked(validateOrganizationAccess).mockRejectedValue(new Error("database credential details"));
  const response = await POST(request(other));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("credential");
});
