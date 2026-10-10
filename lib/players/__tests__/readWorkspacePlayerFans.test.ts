import { beforeEach, expect, it, vi } from "vitest";
import { readWorkspacePlayerFans } from "../readWorkspacePlayerFans";
const m = vi.hoisted(() => ({ access: vi.fn(), contacts: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/sites/authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: m.access }));
vi.mock("@/lib/sites/activity/limitSiteRequest", () => ({ limitSiteRequest: m.rate }));
vi.mock("@/lib/supabase/player_fan_contacts/selectWorkspacePlayerFans", () => ({
  selectWorkspacePlayerFans: m.contacts,
}));
const org = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue(org);
  m.contacts.mockResolvedValue([
    { id: "contact", artists: [{ artist_id: "a" }, { artist_id: "b" }] },
  ]);
});
it("lists organization contacts once with artist relationships after membership authorization", async () => {
  const result = await readWorkspacePlayerFans("member", { organizationId: org });
  expect(m.access).toHaveBeenCalledWith("member", org);
  expect(m.contacts).toHaveBeenCalledWith(org, 0, 50);
  expect(result).toMatchObject({
    scope: "workspace",
    marketingConsent: false,
    fans: [{ id: "contact" }],
  });
});
it("does not query fan data when workspace authorization fails", async () => {
  m.access.mockRejectedValue(new Error("Denied"));
  await expect(readWorkspacePlayerFans("outsider", { organizationId: org })).rejects.toThrow(
    "Denied",
  );
  expect(m.contacts).not.toHaveBeenCalled();
});
it("rejects impersonation fields and unbounded pages before authorization", async () => {
  for (const input of [{ account_id: org }, { owner_id: org }, { limit: 101 }, { offset: -1 }])
    await expect(readWorkspacePlayerFans("member", input)).rejects.toThrow();
  expect(m.access).not.toHaveBeenCalled();
});
