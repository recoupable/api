import { beforeEach, expect, it, vi } from "vitest";
import { processPublicSite } from "../processPublicSite";
const m = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/supabase/sites/selectSite", () => ({ selectSite: m.select }));
vi.mock("@/lib/supabase/sites/insertSignup", () => ({ insertSignup: m.insert }));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => vi.resetAllMocks());
it("returns only the published snapshot, never drafts or ownership", async () => {
  m.select.mockResolvedValue({
    draft: { secret: true },
    owner_id: "private",
    published: { name: "Public" },
  });
  expect(await processPublicSite(id)).toEqual({ snapshot: { name: "Public" } });
});
it("refuses unpublished sites and their signups", async () => {
  m.select.mockResolvedValue({ published: null });
  await expect(processPublicSite(id)).rejects.toMatchObject({ status: 404 });
  await expect(
    processPublicSite(id, { email: "fan@example.com", consent: "yes" }),
  ).rejects.toMatchObject({ status: 404 });
  expect(m.insert).not.toHaveBeenCalled();
});
it("requires valid explicit consent and rejects honeypot", async () => {
  await expect(processPublicSite(id, { email: "fan@example.com" })).rejects.toThrow();
  await expect(
    processPublicSite(id, { email: "fan@example.com", consent: "yes", website: "bot" }),
  ).rejects.toThrow();
  expect(m.insert).not.toHaveBeenCalled();
});
it("records consent against the published name", async () => {
  m.select.mockResolvedValue({ published: { name: "Public" }, draft: { name: "Private" } });
  await processPublicSite(id, { email: "fan@example.com", consent: "yes" });
  expect(m.insert).toHaveBeenCalledWith(
    id,
    "fan@example.com",
    "I agree to receive email updates from Public.",
  );
});

it("does not expose private brand-world guidance in public snapshots", async () => {
  m.select.mockResolvedValue({
    published: { name: "Public", brandWorld: { privateBrief: "customer notes" } },
  });
  expect(await processPublicSite(id)).toEqual({ snapshot: { name: "Public" } });
});
