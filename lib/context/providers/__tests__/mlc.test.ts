import { it, expect, vi } from "vitest";
import { lookupMlcRecording } from "../lookupMlcRecording";
it("filters mismatched ISRCs while retaining the source response", async () => {
  const r = await lookupMlcRecording(
    "USAT22103065",
    "token",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { isrc: "OTHER", title: "wrong" },
          { isrc: "USAT22103065", mlcsongCode: "123", title: "song" },
        ]),
      ),
    ),
  );
  expect(r.candidates).toHaveLength(1);
  expect(r.rejectedCount).toBe(1);
  expect(JSON.stringify(r)).not.toContain("token");
});
it("does not turn provider errors into missing records", async () => {
  await expect(
    lookupMlcRecording(
      "USAT22103065",
      "token",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    ),
  ).rejects.toThrow("401");
});
it("rejects malformed provider payloads", async () => {
  await expect(
    lookupMlcRecording("USAT22103065", "token", vi.fn().mockResolvedValue(new Response("{}"))),
  ).rejects.toThrow();
});
