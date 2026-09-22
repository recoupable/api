import { it, expect, vi } from "vitest";
import { searchChartmetricContext } from "../searchChartmetricContext";
it("keeps candidate data and rate budget without exposing the token", async () => {
  const f = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ obj: { artists: [{ id: 1, name: "Artist" }] } }), {
      headers: { "x-ratelimit-remaining": "9" },
    }),
  );
  const r = await searchChartmetricContext({ query: "Artist", type: "artists" }, "secret", f);
  expect(r.status).toBe("candidates_found");
  expect(r.candidates).toHaveLength(1);
  expect(r.trace.rateLimitRemaining).toBe("9");
  expect(JSON.stringify(r)).not.toContain("secret");
});
it("rejects unexpected shapes rather than returning no matches", async () => {
  await expect(
    searchChartmetricContext(
      { query: "Artist", type: "artists" },
      "secret",
      vi.fn().mockResolvedValue(new Response('{"obj":{}}')),
    ),
  ).rejects.toThrow();
});
it("stops on quota response without retrying", async () => {
  const f = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
  await expect(
    searchChartmetricContext({ query: "Artist", type: "artists" }, "secret", f),
  ).rejects.toThrow("429");
  expect(f).toHaveBeenCalledOnce();
});
