import { FatalError } from "workflow";
import { expect, it, vi } from "vitest";
import { siteExists } from "@/lib/supabase/sites/siteExists";
import { ensureSiteExistsStep } from "@/app/workflows/sites/ensureSiteExistsStep";
vi.mock("@/lib/supabase/sites/siteExists", () => ({ siteExists: vi.fn() }));
it("stops a workflow when its site was deleted", async () => {
  vi.mocked(siteExists).mockResolvedValue(false);
  await expect(ensureSiteExistsStep("removed")).rejects.toBeInstanceOf(FatalError);
});
it("allows an existing site and does not mistake a database outage for deletion", async () => {
  vi.mocked(siteExists).mockResolvedValue(true);
  await expect(ensureSiteExistsStep("site")).resolves.toBeUndefined();
  vi.mocked(siteExists).mockRejectedValue(new Error("database unavailable"));
  await expect(ensureSiteExistsStep("site")).rejects.toThrow("database unavailable");
});
