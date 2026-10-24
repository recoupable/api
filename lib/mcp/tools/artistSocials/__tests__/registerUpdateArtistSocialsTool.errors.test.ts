import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerUpdateArtistSocialsTool } from "../registerUpdateArtistSocialsTool";
import { registerFullOAuthTools } from "@/lib/mcp/oauth/registerFullOAuthTools";
import { registerOAuthTools } from "@/lib/mcp/oauth/registerOAuthTools";
import { prepareFullOAuthTool } from "@/lib/mcp/oauth/prepareFullOAuthTool";

const { update, artists } = vi.hoisted(() => ({ update: vi.fn(), artists: vi.fn() }));

vi.mock("@/lib/artist/updateArtistSocials", () => ({ updateArtistSocials: update }));
vi.mock("@/lib/mcp/tools", () => ({
  registerAllTools: (server: McpServer) => registerUpdateArtistSocialsTool(server),
}));
vi.mock("@/lib/mcp/oauth/checkFullOAuthRateLimit", () => ({ checkFullOAuthRateLimit: vi.fn() }));
vi.mock("@/lib/artists/getArtists", () => ({ getArtists: artists }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: vi.fn(),
}));
vi.mock("@/lib/catalog/getCatalogOwnerIds", () => ({ getCatalogOwnerIds: vi.fn() }));
vi.mock("@/lib/supabase/rooms/selectRoom", () => ({ default: vi.fn() }));
vi.mock("@/lib/emails/assertRecipientsAllowed", () => ({ assertRecipientsAllowed: vi.fn() }));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: vi.fn() }));

type Handler = (args: any, extra?: any) => Promise<any>;

function capture(register: (server: McpServer) => void) {
  const handlers = new Map<string, Handler>();
  register({
    registerTool: (name: string, _config: unknown, handler: Handler) => handlers.set(name, handler),
  } as unknown as McpServer);
  return handlers;
}

const input = { artistId: "owned-creator", urls: ["https://instagram.com/synthetic"] };
const access = {
  accountId: "caller",
  clientId: "synthetic-client",
  grantId: "synthetic-grant",
  scopes: ["mcp:tools"],
  expiresAt: 9999999999,
  resource: "https://example.test/mcp",
  context: "personal" as const,
};
const extra = {
  authInfo: {
    token: "synthetic-opaque-token",
    clientId: access.clientId,
    scopes: access.scopes,
    extra: { accountId: access.accountId, oauth: access },
  },
};
const genericError = {
  content: [
    {
      type: "text",
      text: JSON.stringify({ success: false, message: "Failed to update artist socials." }),
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected synthetic fetch")));
  artists.mockResolvedValue([{ account_id: "owned-creator" }]);
});

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("socials failure message without changing authorization", () => {
  it.each([
    new Error("Synthetic database table/private SQL detail"),
    new TypeError("Synthetic internal URL https://internal.example.test/"),
  ])("returns the existing generic fallback for Error instances: %s", async error => {
    update.mockRejectedValue(error);
    const run = capture(registerUpdateArtistSocialsTool).get("update_artist_socials")!;

    expect(await run(input)).toEqual(genericError);
    expect(console.error).toHaveBeenCalledExactlyOnceWith("Error updating artist socials:", error);
    expect(update).toHaveBeenCalledExactlyOnceWith(input.artistId, { INSTAGRAM: input.urls[0] });
  });

  it("preserves the existing generic response for a non-Error rejection", async () => {
    update.mockRejectedValue({ message: "Synthetic internal object detail" });

    expect(
      await capture(registerUpdateArtistSocialsTool).get("update_artist_socials")!(input),
    ).toEqual(genericError);
  });

  it("preserves successful URL mapping and response", async () => {
    const socials = [{ id: "synthetic-social" }];
    update.mockResolvedValue(socials);

    const result = await capture(registerUpdateArtistSocialsTool).get("update_artist_socials")!(
      input,
    );

    expect(JSON.parse(result.content[0].text)).toEqual({
      success: true,
      message: "Artist socials updated successfully.",
      socials,
    });
    expect(update).toHaveBeenCalledExactlyOnceWith(input.artistId, { INSTAGRAM: input.urls[0] });
  });

  it("keeps the generic response through the actual full-OAuth wrapper and ownership preparation", async () => {
    update.mockRejectedValue(new Error("Synthetic internal database detail"));
    const run = capture(server =>
      registerFullOAuthTools(server, vi.fn().mockResolvedValue(access), {
        prepare: prepareFullOAuthTool,
        listArtists: vi.fn(),
      }),
    ).get("update_artist_socials")!;

    expect(await run(input, extra)).toEqual(genericError);
    expect(artists).toHaveBeenCalledExactlyOnceWith({ accountId: "caller" });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("preserves the full-OAuth foreign-creator denial before the domain operation", async () => {
    const run = capture(server =>
      registerFullOAuthTools(server, vi.fn().mockResolvedValue(access), {
        prepare: prepareFullOAuthTool,
        listArtists: vi.fn(),
      }),
    ).get("update_artist_socials")!;

    expect((await run({ ...input, artistId: "foreign-creator" }, extra)).isError).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("preserves revoked-grant denial before ownership preparation or the domain operation", async () => {
    const run = capture(server =>
      registerFullOAuthTools(server, vi.fn().mockResolvedValue(undefined), {
        prepare: prepareFullOAuthTool,
        listArtists: vi.fn(),
      }),
    ).get("update_artist_socials")!;

    expect((await run(input, extra)).isError).toBe(true);
    expect(artists).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the update tool absent from limited OAuth", () => {
    const registered = capture(server => registerOAuthTools(server, {} as never, vi.fn()));
    expect(registered.has("update_artist_socials")).toBe(false);
  });
});
