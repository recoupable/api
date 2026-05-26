import { describe, it, expect, beforeEach, vi } from "vitest";
import { findLegacyAccountRepo } from "@/lib/github/findLegacyAccountRepo";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";

vi.mock("@/lib/github/getServiceGithubToken", () => ({
  getServiceGithubToken: vi.fn(() => "tok"),
}));

const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";

describe("findLegacyAccountRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
  });

  it("returns undefined when GITHUB_TOKEN is missing", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue(undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await findLegacyAccountRepo({ accountId });

    expect(result).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
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

    const result = await findLegacyAccountRepo({ accountId });

    expect(result).toBe(`sweetman-${accountId}`);
  });

  it("ignores the new bare-<accountId> repo (we don't want to rename it onto itself)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [{ name: accountId }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await findLegacyAccountRepo({ accountId });

    expect(result).toBeNull();
  });

  it("returns null when no items match the legacy pattern", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await findLegacyAccountRepo({ accountId });

    expect(result).toBeNull();
  });

  it("returns undefined on non-OK response (caller treats as miss)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));

    const result = await findLegacyAccountRepo({ accountId });

    expect(result).toBeUndefined();
  });

  it("encodes the search query as <accountId>+in:name+org:recoupable", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await findLegacyAccountRepo({ accountId: "id-1" });

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("/search/repositories?q=");
    expect(decodeURIComponent(url.split("?q=")[1].split("&")[0])).toBe(
      "id-1 in:name org:recoupable",
    );
  });
});
