import { describe, it, expect, beforeEach, vi } from "vitest";
import { findLegacyAccountRepo } from "@/lib/github/findLegacyAccountRepo";

const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";

describe("findLegacyAccountRepo", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the legacy name when a *-<accountId> match exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ name: `sweetman-${accountId}` }, { name: "some-unrelated-repo" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await findLegacyAccountRepo({
      owner: "recoupable",
      accountId,
      token: "tok",
    });

    expect(result).toBe(`sweetman-${accountId}`);
  });

  it("ignores the new bare-<accountId> repo (we don't want to rename it onto itself)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [{ name: accountId }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await findLegacyAccountRepo({
      owner: "recoupable",
      accountId,
      token: "tok",
    });

    expect(result).toBeNull();
  });

  it("returns null when no items match the legacy pattern", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await findLegacyAccountRepo({
      owner: "recoupable",
      accountId,
      token: "tok",
    });

    expect(result).toBeNull();
  });

  it("returns undefined on non-OK response (caller treats as miss)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));

    const result = await findLegacyAccountRepo({
      owner: "recoupable",
      accountId,
      token: "tok",
    });

    expect(result).toBeUndefined();
  });

  it("encodes the search query as <accountId>+in:name+org:<owner>", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await findLegacyAccountRepo({
      owner: "recoupable",
      accountId: "id-1",
      token: "tok",
    });

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("/search/repositories?q=");
    expect(decodeURIComponent(url.split("?q=")[1].split("&")[0])).toBe(
      "id-1 in:name org:recoupable",
    );
  });
});
