import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "../../../../app/mcp/route";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), index: 0 }));
vi.mock("mcp-handler", () => ({
  createMcpHandler: () => {
    const index = mocks.index++;
    return async () => new Response(String(index));
  },
  withMcpAuth: (handler: () => Promise<Response>) => handler,
}));
vi.mock("../../tools", () => ({ registerAllTools: vi.fn() }));
vi.mock("../registerOAuthTools", () => ({ registerOAuthTools: vi.fn() }));
vi.mock("../registerFullOAuthTools", () => ({ registerFullOAuthTools: vi.fn() }));
vi.mock("../createOAuthToolServices", () => ({ createOAuthToolServices: vi.fn() }));
vi.mock("../createFullOAuthToolServices", () => ({ createFullOAuthToolServices: vi.fn() }));
vi.mock("../../verifyApiKey", () => ({ verifyBearerToken: mocks.verify }));
vi.mock("../../../oauth/verifyOAuthBearer", () => ({ verifyOAuthBearer: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it.each([
  [{ scopes: ["mcp:tools"], extra: { accountId: "owner" } }, "0"],
  [{ scopes: ["mcp:read", "mcp:write"], extra: { oauth: {} } }, "1"],
  [{ scopes: ["mcp:tools"], extra: { oauth: {} } }, "2"],
])("keeps legacy, limited OAuth and full OAuth catalogs separate", async (auth, expected) => {
  mocks.verify.mockResolvedValue(auth);
  const response = await POST(
    new Request("https://api.recoupable.dev/mcp", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    }),
  );
  expect(await response.text()).toBe(expected);
});
