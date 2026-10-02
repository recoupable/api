import { expect, it, vi } from "vitest";
import { updateSitePublication } from "@/lib/supabase/sites/updateSitePublication";
const m = vi.hoisted(() => {
  const q: any = {};
  for (const key of ["update", "eq", "select"]) q[key] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => ({ data: { revision: 7 }, error: null }));
  return q;
});
vi.mock("@/lib/supabase/sites/siteTable", () => ({ siteTable: () => m }));
it("publishes without advancing the active builder's draft revision", async () => {
  await updateSitePublication({ id: "s", owner_id: "o", revision: 7 } as any, {
    published: null,
    published_at: null,
  });
  expect(m.update.mock.calls[0][0]).not.toHaveProperty("revision");
  expect(m.update.mock.calls[0][0]).not.toHaveProperty("draft");
  expect(m.eq).toHaveBeenCalledWith("revision", 7);
  expect(m.eq).toHaveBeenCalledWith("owner_id", "o");
});
