import { expect, it, vi } from "vitest";
import { readRepairCheckpointStep } from "@/app/workflows/sites/readRepairCheckpointStep";
import { readSiteRepairControl } from "../production/readSiteRepairControl";
import type { Site } from "../schema";
vi.mock("../production/readSiteRepairControl", () => ({ readSiteRepairControl: vi.fn() }));
it("timestamps the completed authoritative control read inside the step", async () => {
  let completedAt = 0;
  vi.mocked(readSiteRepairControl).mockImplementationOnce(async () => {
    completedAt = Date.now();
    return { revision: 7, cancelled: false };
  });
  const site = { id: "site", revision: 7 } as Site;
  const checkpoint = await readRepairCheckpointStep(site, "account");
  expect(readSiteRepairControl).toHaveBeenCalledWith(site, "account");
  expect(checkpoint).toMatchObject({ revision: 7, cancelled: false });
  expect(checkpoint.now).toBeGreaterThanOrEqual(completedAt);
  expect(checkpoint.now).toBeLessThanOrEqual(Date.now());
});
it("propagates control failures instead of admitting work", async () => {
  vi.mocked(readSiteRepairControl).mockRejectedValueOnce(new Error("Access revoked"));
  await expect(readRepairCheckpointStep({ id: "site" } as Site, "account")).rejects.toThrow(
    "Access revoked",
  );
});
