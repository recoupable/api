import { expect, it, vi } from "vitest";
import { recordSiteActivity } from "../recordSiteActivity";
const m = vi.hoisted(() => ({ site: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/supabase/sites/selectSite", () => ({ selectSite: m.site }));
vi.mock("@/lib/supabase/site_activity_events/insertSiteActivity", () => ({
  insertSiteActivity: m.insert,
}));
const id = "11111111-1111-4111-8111-111111111111";
it("records fixed events only for a published site", async () => {
  m.site.mockResolvedValue({ published: {} });
  await recordSiteActivity(id, { id, visitId: id, event: "start" });
  expect(m.insert).toHaveBeenCalledWith({ id, site_id: id, visit_id: id, event: "start" });
  await expect(
    recordSiteActivity(id, { id, visitId: id, event: "email", email: "fan@example.com" }),
  ).rejects.toThrow();
});
it("rejects unpublished sites", async () => {
  m.site.mockResolvedValue({ published: null });
  await expect(recordSiteActivity(id, { id, visitId: id, event: "visit" })).rejects.toMatchObject({
    status: 404,
  });
});
