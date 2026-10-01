import { expect, it, vi } from "vitest";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { ensureSiteExistsStep } from "@/app/workflows/sites/ensureSiteExistsStep";
vi.mock("@/lib/supabase/sites/selectSite", () => ({ selectSite: vi.fn() }));
it("stops a workflow when its site was deleted", async () => {
  vi.mocked(selectSite).mockResolvedValue(null);
  await expect(ensureSiteExistsStep("removed")).rejects.toThrow("Site deleted");
});
it("allows an existing site and does not mistake a database outage for deletion", async () => {
  vi.mocked(selectSite).mockResolvedValue({ id: "site" } as never);
  await expect(ensureSiteExistsStep("site")).resolves.toBeUndefined();
  vi.mocked(selectSite).mockRejectedValue(new Error("database unavailable"));
  await expect(ensureSiteExistsStep("site")).rejects.toThrow("database unavailable");
});
