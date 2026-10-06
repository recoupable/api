import { beforeEach, expect, it, vi } from "vitest";
import { createOAuthToolServices } from "../createOAuthToolServices";
const mocks = vi.hoisted(() => ({
  artists: vi.fn(),
  update: vi.fn(),
  info: vi.fn(),
  create: vi.fn(),
  socials: vi.fn(),
  chats: vi.fn(),
}));
vi.mock("../../../supabase/account_artist_ids/selectOAuthPersonalArtists", () => ({
  selectOAuthPersonalArtists: mocks.artists,
}));
vi.mock("../../../supabase/accounts/updateAccount", () => ({ updateAccount: mocks.update }));
vi.mock("../../../supabase/account_info/updateAccountInfo", () => ({
  updateAccountInfo: mocks.info,
}));
vi.mock("../../../artists/createArtistInDb", () => ({ createArtistInDb: mocks.create }));
vi.mock("../../../artist/getArtistSocials", () => ({ getArtistSocials: mocks.socials }));
vi.mock("../../../supabase/chats/selectChatsWithSessions", () => ({
  selectChatsWithSessions: mocks.chats,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.artists.mockResolvedValue([{ id: "own-artist", name: "Owned" }]);
});
it("denies another account's artist before read or write work", async () => {
  const services = createOAuthToolServices();
  await expect(
    services.updateArtist("alice", "other-artist", { name: "Changed" }),
  ).rejects.toThrow();
  await expect(services.getSocials("alice", "other-artist")).rejects.toThrow();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.socials).not.toHaveBeenCalled();
});
it("changes only supplied fields on an owned artist", async () => {
  mocks.update.mockResolvedValue({ id: "own-artist" });
  await createOAuthToolServices().updateArtist("alice", "own-artist", { name: "New name" });
  expect(mocks.update).toHaveBeenCalledWith("own-artist", { name: "New name" });
  expect(mocks.info).not.toHaveBeenCalled();
});
it("always queries the personal account and removes organization artist conversations", async () => {
  mocks.chats.mockResolvedValue([
    { id: "personal", session: { artist_id: null } },
    { id: "owned", session: { artist_id: "own-artist" } },
    { id: "organization", session: { artist_id: "org-artist" } },
  ]);
  const result = (await createOAuthToolServices().getChats("admin-account")) as {
    chats: { id: string }[];
  };
  expect(mocks.chats).toHaveBeenCalledWith({ accountIds: ["admin-account"] });
  expect(result.chats.map(chat => chat.id)).toEqual(["personal", "owned"]);
});
