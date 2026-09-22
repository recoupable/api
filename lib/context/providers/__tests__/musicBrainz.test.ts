import { it, expect, vi } from "vitest";
import { lookupMusicBrainzIsrc } from "../lookupMusicBrainzIsrc";
it("rejects invalid identifiers without a request", async () => {
  const fetcher = vi.fn();
  await expect(lookupMusicBrainzIsrc("bad", async () => {}, fetcher)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("keeps ambiguous recordings as candidates", async () => {
  const permit = vi.fn();
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        isrc: "USAT22103065",
        recordings: [
          { id: "a", title: "One" },
          { id: "b", title: "Two" },
        ],
      }),
    ),
  );
  const result = await lookupMusicBrainzIsrc("US-AT2-21-03065", permit, fetcher);
  expect(permit).toHaveBeenCalledOnce();
  expect(result.status).toBe("needs_review");
  expect(result.recordings).toHaveLength(2);
});
it("reports not found separately from provider errors", async () => {
  const result = await lookupMusicBrainzIsrc(
    "USAT22103065",
    async () => {},
    vi.fn().mockResolvedValue(new Response("", { status: 404 })),
  );
  expect(result.status).toBe("not_found");
});
