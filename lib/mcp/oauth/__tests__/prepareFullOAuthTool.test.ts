import { beforeEach, describe, it, expect, vi } from "vitest";
import { prepareFullOAuthTool } from "../prepareFullOAuthTool";
vi.mock("../checkFullOAuthRateLimit", () => ({ checkFullOAuthRateLimit: vi.fn() }));
const mocks = vi.hoisted(() => ({
  artists: vi.fn(),
  orgs: vi.fn(),
  catalogs: vi.fn(),
  owners: vi.fn(),
  room: vi.fn(),
  recipients: vi.fn(),
  emails: vi.fn(),
  tasks: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: mocks.tasks,
}));
vi.mock("@/lib/artists/getArtists", () => ({ getArtists: mocks.artists }));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: mocks.orgs,
}));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: mocks.catalogs,
}));
vi.mock("@/lib/catalog/getCatalogOwnerIds", () => ({ getCatalogOwnerIds: mocks.owners }));
vi.mock("@/lib/supabase/rooms/selectRoom", () => ({ default: mocks.room }));
vi.mock("@/lib/emails/assertRecipientsAllowed", () => ({
  assertRecipientsAllowed: mocks.recipients,
}));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: mocks.emails }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.artists.mockResolvedValue([{ account_id: "artist" }]);
  mocks.orgs.mockResolvedValue([{ organization_id: "org" }]);
  mocks.catalogs.mockResolvedValue([{ id: "catalog" }]);
  mocks.owners.mockResolvedValue(["owner", "org"]);
  mocks.room.mockResolvedValue({ account_id: "owner", artist_id: "artist" });
  mocks.recipients.mockResolvedValue({ allowed: true });
  mocks.emails.mockResolvedValue([{ email: "owner@example.com" }]);
});
describe("delegated resource authorization", () => {
  it.each(["update_task", "delete_task"])(
    "requires the task owner even for an organization peer: %s",
    async name => {
      mocks.tasks.mockResolvedValue([]);
      await expect(prepareFullOAuthTool(name, { id: "task" }, "owner")).rejects.toThrow();
      mocks.tasks.mockResolvedValue([{ id: "task", account_id: "org" }]);
      await expect(prepareFullOAuthTool(name, { id: "task" }, "owner")).rejects.toThrow();
      mocks.tasks.mockResolvedValue([{ id: "task", account_id: "owner" }]);
      await expect(prepareFullOAuthTool(name, { id: "task" }, "owner")).resolves.toMatchObject({
        id: "task",
      });
      expect(mocks.tasks).toHaveBeenCalledWith({ id: "task", account_id: "owner" });
    },
  );
  it("allows accessible artists and rejects foreign artists", async () => {
    await expect(
      prepareFullOAuthTool("update_artist_socials", { artistId: "artist" }, "owner"),
    ).resolves.toMatchObject({ artistId: "artist" });
    await expect(
      prepareFullOAuthTool("update_artist_socials", { artistId: "foreign" }, "owner"),
    ).rejects.toThrow();
  });
  it("checks every catalog in a batch before executing", async () => {
    await expect(
      prepareFullOAuthTool(
        "insert_catalog_songs",
        { songs: [{ catalog_id: "catalog" }, { catalog_id: "foreign" }] },
        "owner",
      ),
    ).rejects.toThrow();
  });
  it("does not allow arbitrary organizations", async () => {
    await expect(
      prepareFullOAuthTool("create_new_artist", { organization_id: "foreign" }, "owner"),
    ).rejects.toThrow();
  });
  it("rejects copying a foreign or ownerless room", async () => {
    for (const account_id of ["foreign", null]) {
      mocks.room.mockResolvedValue({ account_id });
      await expect(
        prepareFullOAuthTool("create_new_artist", { active_conversation_id: "room" }, "owner"),
      ).rejects.toThrow();
    }
  });
  it("validates all compacted chats before any mutation", async () => {
    mocks.room
      .mockResolvedValueOnce({ account_id: "owner" })
      .mockResolvedValueOnce({ account_id: "foreign" });
    await expect(
      prepareFullOAuthTool("compact_chats", { chat_id: ["one", "two"] }, "owner"),
    ).rejects.toThrow();
  });
  it("enforces the shared email recipient restriction including cc", async () => {
    mocks.recipients.mockResolvedValue({ allowed: false });
    await expect(
      prepareFullOAuthTool(
        "send_email",
        { to: ["owner@example.com"], cc: ["foreign@example.com"], text: "hello" },
        "owner",
      ),
    ).rejects.toThrow();
    expect(mocks.recipients).toHaveBeenCalledWith({
      accountId: "owner",
      recipients: ["owner@example.com", "foreign@example.com"],
    });
  });
  it("binds support sender identity and drops arbitrary email headers", async () => {
    expect(
      await prepareFullOAuthTool(
        "contact_team",
        { active_account_email: "fake@example.com" },
        "owner",
      ),
    ).toMatchObject({ active_account_email: "owner@example.com" });
    expect(
      await prepareFullOAuthTool(
        "send_email",
        { to: ["owner@example.com"], text: "hello", headers: { Bcc: "foreign@example.com" } },
        "owner",
      ),
    ).toHaveProperty("headers", {});
  });
});
