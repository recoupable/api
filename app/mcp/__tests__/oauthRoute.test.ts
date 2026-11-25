import { z } from "zod";
import { afterEach, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { POST } from "../route";
import { POST as staffPOST } from "../staff/route";
const { access, verify, createArtist } = vi.hoisted(() => ({
  access: {
    accountId: "alice",
    clientId: "agent",
    grantId: "grant",
    context: "personal",
    resource: "https://api.example/mcp",
    scopes: ["mcp:read", "mcp:write"],
    expiresAt: 9999999999,
  },
  verify: vi.fn(),
  createArtist: vi.fn(async () => ({ id: "fixture-artist" })),
}));
vi.mock("@/lib/mcp/tools", () => ({
  registerAllTools: (server: McpServer) => {
    server.registerTool(
      "get_tasks",
      { inputSchema: z.object({ account_id: z.string() }) },
      async args => ({ content: [{ type: "text", text: JSON.stringify(args) }] }),
    );
    server.registerTool("get_api_key", { inputSchema: z.object({}) }, async () => ({
      content: [],
    }));
  },
}));
vi.mock("@/lib/mcp/oauth/createFullOAuthToolServices", () => ({
  createFullOAuthToolServices: () => ({
    prepare: async (_name: string, args: Record<string, unknown>) => args,
    listArtists: async () => [],
  }),
}));
vi.mock("@/lib/mcp/verifyApiKey", () => ({ verifyBearerToken: verify }));
vi.mock("@/lib/oauth/verifyOAuthBearer", () => ({ verifyOAuthBearer: async () => access }));
vi.mock("@/lib/mcp/oauth/createOAuthToolServices", () => ({
  createOAuthToolServices: () => ({
    listArtists: async () => [],
    createArtist,
    updateArtist: async () => ({}),
    getSocials: async () => [],
    getChats: async () => [],
  }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it.each([false, true])(
  "routes delegated credentials through actual MCP auth middleware without exposing credentials (full=%s)",
  async full => {
    access.scopes = full ? ["mcp:tools"] : ["mcp:read", "mcp:write"];
    vi.stubEnv("OAUTH_ENABLED", "true");
    vi.stubEnv("OAUTH_ISSUER", "https://api.example/api/oauth");
    verify.mockImplementation(async (_req: Request, bearer: string) =>
      bearer === "opaque-token"
        ? {
            token: bearer,
            clientId: access.clientId,
            scopes: access.scopes,
            extra: { accountId: access.accountId, oauth: access },
          }
        : undefined,
    );
    const client = new Client({ name: "route-fixture", version: "1" });
    const transport = new StreamableHTTPClientTransport(new URL(access.resource), {
      requestInit: { headers: { Authorization: "Bearer opaque-token" } },
      fetch: async (input, init) => POST(new Request(input, init)),
    });
    try {
      await client.connect(transport);
      const inventory = await client.listTools();
      expect(inventory.tools.map(tool => tool.name)).not.toContain("get_api_key");
      if (full) {
        expect(inventory.tools.map(tool => tool.name).sort()).toEqual([
          "get_tasks",
          "list_artists",
          "open_recoup_workflows",
          "open_recoup_workflows_sidebar",
          "recoup_skills",
        ]);
        const result = await client.callTool({ name: "get_tasks", arguments: {} });
        expect(result.isError).not.toBe(true);
        expect(JSON.stringify(result)).toContain("alice");
      } else {
        expect(inventory.tools.map(tool => tool.name)).toContain("create_new_artist");
        expect(
          (
            await client.callTool({
              name: "create_new_artist",
              arguments: { name: "Route fixture" },
            })
          ).isError,
        ).not.toBe(true);
        expect(createArtist).toHaveBeenCalledWith("alice", "Route fixture");
      }
      const opened = await client.callTool({ name: "open_recoup_workflows", arguments: {} });
      expect(opened.structuredContent).toMatchObject({ title: "Recoup", version: 1 });
      const ui = await client.readResource({ uri: "ui://recoup/explore.html" });
      expect(ui.contents[0].mimeType).toBe("text/html;profile=mcp-app");
      expect(verify).toHaveBeenCalledWith(expect.any(Request), "opaque-token");
    } finally {
      await client.close();
    }
    const missing = await POST(new Request(access.resource, { method: "POST" }));
    expect(missing.status).toBe(401);
  },
);

vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));

const publicSkill = "skill://recoup-public-test/SKILL.md";
const staffSkill = "skill://recoup-internal-test/SKILL.md";

vi.mock("@modelcontextprotocol/server/ext/skills/node", async () => {
  const { memorySkillFiles } = await import("@modelcontextprotocol/server/ext/skills");
  const skill = (name: string) => `---\nname: ${name}\ndescription: Fixture skill\n---\nTest.\n`;
  return {
    nodeSkillFiles: () =>
      memorySkillFiles({
        "recoup-public-test/SKILL.md": skill("recoup-public-test"),
        "recoup-public-test/references/checklist.md": "Checklist\n",
        "recoup-internal-test/SKILL.md": skill("recoup-internal-test"),
      }),
  };
});
const isRecoupAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/organizations/isRecoupAdmin", () => ({ isRecoupAdmin }));

function modernRequest(
  method: string,
  params: Record<string, unknown> = {},
  token = "test",
  url = access.resource,
) {
  const name = params.name ?? params.uri;
  return new Request(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(typeof name === "string" && ["resources/read", "tools/call"].includes(method)
        ? { "Mcp-Name": name }
        : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

it("advertises native skills and serves their manifests and files through authenticated MCP", async () => {
  verify.mockImplementation(async (_request, token) =>
    token === "test"
      ? { token, clientId: "client", scopes: ["mcp:tools"], extra: { accountId: "member" } }
      : undefined,
  );
  isRecoupAdmin.mockResolvedValue(false);

  expect((await POST(modernRequest("server/discover", {}, "unknown"))).status).toBe(401);
  const discovery = await (await POST(modernRequest("server/discover"))).json();
  expect(discovery.result.capabilities).toMatchObject({
    resources: {},
    extensions: { "io.modelcontextprotocol/skills": { directoryRead: true } },
  });
  expect(discovery.result.supportedVersions).toContain("2026-07-28");

  const listing = await (await POST(modernRequest("skills/list"))).json();
  expect(listing.result.cacheScope).toBe("private");
  expect(listing.result.skills.map((skill: { uri: string }) => skill.uri)).toEqual([publicSkill]);

  const lookup = await (await POST(modernRequest("skills/get", { uri: publicSkill }))).json();
  expect(lookup.result.skill).toEqual(listing.result.skills[0]);
  const uri = "skill://recoup-public-test/references/checklist.md";
  const file = await (await POST(modernRequest("resources/read", { uri }))).json();
  const readable = Buffer.from(file.result.contents[0].text);
  const { createHash } = await import("node:crypto");
  expect(lookup.result.skill.resources).toContainEqual({
    uri,
    digest: `sha256:${createHash("sha256").update(readable).digest("hex")}`,
    size: readable.length,
  });

  const denied = await (await POST(modernRequest("skills/get", { uri: staffSkill }))).json();
  expect(denied.error.code).toBe(-32602);
  const deniedRead = await (
    await POST(modernRequest("resources/read", { uri: staffSkill }))
  ).json();
  expect(deniedRead.error).toBeDefined();

  isRecoupAdmin.mockResolvedValue(true);
  const staffOnMain = await (await POST(modernRequest("skills/get", { uri: staffSkill }))).json();
  expect(staffOnMain.result.skill.uri).toBe(staffSkill);
  expect(isRecoupAdmin).toHaveBeenCalledWith("member");
});

it("uses the same full OAuth tool restrictions and account binding on modern MCP", async () => {
  access.scopes = ["mcp:tools"];
  verify.mockResolvedValue({
    token: "test",
    clientId: access.clientId,
    scopes: access.scopes,
    extra: { accountId: access.accountId, oauth: access },
  });
  const listing = await (await POST(modernRequest("tools/list"))).json();
  expect(listing.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
    "get_tasks",
    "list_artists",
    "open_recoup_workflows",
    "open_recoup_workflows_sidebar",
    "recoup_skills",
  ]);
  const called = await (
    await POST(modernRequest("tools/call", { name: "get_tasks", arguments: {} }))
  ).json();
  expect(called.result.content[0].text).toContain("alice");
  const ui = await (
    await POST(modernRequest("resources/read", { uri: "ui://recoup/explore.html" }))
  ).json();
  expect(ui.result.contents[0].mimeType).toBe("text/html;profile=mcp-app");
});

it("serves public skills to limited OAuth grants without elevating their tool permissions", async () => {
  access.scopes = ["mcp:read"];
  verify.mockResolvedValue({
    token: "test",
    clientId: access.clientId,
    scopes: access.scopes,
    extra: { accountId: access.accountId, oauth: access },
  });
  isRecoupAdmin.mockResolvedValue(false);
  const listing = await (await POST(modernRequest("skills/list"))).json();
  expect(listing.result.skills.map((skill: { uri: string }) => skill.uri)).toEqual([publicSkill]);
  const write = await POST(
    modernRequest("tools/call", { name: "create_new_artist", arguments: { name: "Fixture" } }),
  );
  expect(write.status).toBe(403);
  expect(createArtist).not.toHaveBeenCalled();
});

it("keeps selected Context grants out of skill discovery", async () => {
  verify.mockResolvedValue({
    token: "test",
    clientId: access.clientId,
    scopes: ["mcp:tools"],
    extra: { accountId: access.accountId, oauth: { ...access, selectedContext: {} } },
  });
  const discovery = await (await POST(modernRequest("server/discover"))).json();
  expect(discovery.result.capabilities.extensions).toBeUndefined();
  const direct = await (await POST(modernRequest("skills/get", { uri: publicSkill }))).json();
  expect(direct.error.code).toBe(-32601);
});

it("serves only internal skills on the staff connection and rechecks staff access on every read", async () => {
  verify.mockResolvedValue({
    token: "test",
    clientId: access.clientId,
    scopes: ["mcp:tools"],
    extra: { accountId: "staff" },
  });
  isRecoupAdmin.mockResolvedValue(true);
  const send = (method: string, params?: Record<string, unknown>) =>
    staffPOST(modernRequest(method, params, "test", `${access.resource}/staff`));

  const discover = await (await send("server/discover")).json();
  expect(discover.result._meta["io.modelcontextprotocol/serverInfo"].name).toBe("recoup-staff");
  expect(discover.result.capabilities.tools).toBeUndefined();
  const list = await (await send("skills/list")).json();
  expect(list.result.skills.map((skill: { uri: string }) => skill.uri)).toEqual([staffSkill]);
  expect(list.result.cacheScope).toBe("private");
  const lookup = await (await send("skills/get", { uri: staffSkill })).json();
  expect(lookup.result.skill.uri).toBe(staffSkill);
  const file = await (await send("resources/read", { uri: staffSkill })).json();
  expect(file.result.contents[0].text).toContain("name: recoup-internal-test");
  const elsewhere = await (await send("skills/get", { uri: publicSkill })).json();
  expect(elsewhere.error.code).toBe(-32602);

  isRecoupAdmin.mockResolvedValue(false);
  expect((await send("skills/list")).status).toBe(403);
  expect((await send("skills/get", { uri: staffSkill })).status).toBe(403);
  expect((await send("resources/read", { uri: staffSkill })).status).toBe(403);
});

it("challenges the staff connection for full-tools scope at the canonical MCP resource", async () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  vi.stubEnv("OAUTH_ISSUER", "https://api.example/api/oauth");
  const request = () => modernRequest("server/discover", {}, "test", `${access.resource}/staff`);
  verify.mockResolvedValue(undefined);
  const unauthorized = await staffPOST(request());
  expect(unauthorized.status).toBe(401);
  expect(unauthorized.headers.get("WWW-Authenticate")).toBe(
    'Bearer resource_metadata="https://api.example/.well-known/oauth-protected-resource/mcp", scope="mcp:tools"',
  );

  const identity = { token: "test", clientId: access.clientId };
  verify.mockResolvedValue({
    ...identity,
    scopes: ["mcp:read"],
    extra: { accountId: "staff", oauth: access },
  });
  const limited = await staffPOST(request());
  expect(limited.status).toBe(403);
  expect(limited.headers.get("WWW-Authenticate")).toContain('scope="mcp:tools"');

  verify.mockResolvedValue({
    ...identity,
    scopes: ["mcp:tools"],
    extra: { accountId: "staff", oauth: { ...access, selectedContext: {} } },
  });
  expect((await staffPOST(request())).status).toBe(403);
  expect(isRecoupAdmin).not.toHaveBeenCalled();
});

it("grants staff skills to the exact configured account without requiring organization membership", async () => {
  const grantedAccount = "ef19d455-2c61-4051-a38e-bc2500b1c880";
  vi.stubEnv("RECOUP_STAFF_SKILL_ACCOUNT_IDS", ` ${grantedAccount} ,`);
  isRecoupAdmin.mockResolvedValue(false);
  const request = () => modernRequest("skills/list", {}, "test", `${access.resource}/staff`);
  const auth = { token: "test", clientId: access.clientId, scopes: ["mcp:tools"] };
  verify.mockResolvedValue({ ...auth, extra: { accountId: grantedAccount } });
  const granted = await staffPOST(request());
  expect(granted.status).toBe(200);
  expect(isRecoupAdmin).not.toHaveBeenCalled();

  verify.mockResolvedValue({ ...auth, extra: { accountId: grantedAccount.slice(0, -1) } });
  expect((await staffPOST(request())).status).toBe(403);

  verify.mockResolvedValue({
    ...auth,
    scopes: ["mcp:read"],
    extra: { accountId: grantedAccount },
  });
  expect((await staffPOST(request())).status).toBe(403);

  vi.stubEnv("RECOUP_STAFF_SKILL_ACCOUNT_IDS", "");
  verify.mockResolvedValue({ ...auth, extra: { accountId: grantedAccount } });
  expect((await staffPOST(request())).status).toBe(403);
});

const getVerifiedPrivyEmails = vi.hoisted(() => vi.fn());
vi.mock("@/lib/privy/getVerifiedPrivyEmails", () => ({ getVerifiedPrivyEmails }));

it("uses the signed-in identity for native skills and the ChatGPT tool on the same connection", async () => {
  const subject = "did:privy:connector-staff";
  access.scopes = ["mcp:read"];
  verify.mockResolvedValue({
    token: "test",
    clientId: access.clientId,
    scopes: access.scopes,
    extra: { accountId: access.accountId, oauth: { ...access, subject } },
  });
  isRecoupAdmin.mockResolvedValue(false);
  const client = new Client({ name: "connector-fixture", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(access.resource), {
      requestInit: { headers: { Authorization: "Bearer test" } },
      fetch: async (input, init) => POST(new Request(input, init)),
    }),
  );
  const tool = (args: Record<string, unknown>) =>
    client.callTool({ name: "recoup_skills", arguments: args });
  try {
    getVerifiedPrivyEmails.mockResolvedValue(["someone@recoupable.com.example"]);
    const publicList = await tool({});
    expect(JSON.stringify(publicList)).toContain("recoup-public-test");
    expect(JSON.stringify(publicList)).not.toContain("recoup-internal-test");
    expect((await tool({ skill: "recoup-internal-test" })).isError).toBe(true);

    getVerifiedPrivyEmails.mockResolvedValue(["staff@recoupable.com"]);
    const staffList = await tool({});
    expect(JSON.stringify(staffList)).toContain("recoup-public-test");
    expect(JSON.stringify(staffList)).toContain("recoup-internal-test");
    expect(JSON.stringify(await tool({ skill: "recoup-internal-test" }))).toContain(
      "name: recoup-internal-test",
    );
    expect(
      JSON.stringify(await tool({ skill: "recoup-public-test", file: "references/checklist.md" })),
    ).toContain("Checklist");
    expect(
      (await tool({ skill: "recoup-public-test", file: "../recoup-internal-test/SKILL.md" }))
        .isError,
    ).toBe(true);
    expect(getVerifiedPrivyEmails).toHaveBeenCalledWith(subject);

    const native = await (await POST(modernRequest("skills/list"))).json();
    expect(native.result.skills.map((skill: { uri: string }) => skill.uri).sort()).toEqual(
      [staffSkill, publicSkill].sort(),
    );

    getVerifiedPrivyEmails.mockResolvedValue([]);
    expect((await tool({ skill: "recoup-internal-test" })).isError).toBe(true);
    const revoked = await (await POST(modernRequest("resources/read", { uri: staffSkill }))).json();
    expect(revoked.error).toBeDefined();
  } finally {
    await client.close();
  }
});
