import { it, expect, vi } from "vitest";
import { lookupMlcWork } from "../lookupMlcWork";
it("rejects a different returned work identity", async () => {
  await expect(
    lookupMlcWork(
      "123",
      "secret",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ mlcSongCode: "999" }))),
    ),
  ).rejects.toThrow("different");
});
it("preserves source collection shares without generating ownership", async () => {
  const r = await lookupMlcWork(
    "123",
    "secret",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ mlcSongCode: "123", publishers: [{ collectionShare: 50 }] })),
      ),
  );
  expect(r.work?.publishers?.[0].collectionShare).toBe(50);
  expect(r.ownershipVerified).toBe(false);
});
