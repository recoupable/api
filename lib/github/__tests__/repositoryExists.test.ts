import { describe, it, expect, beforeEach, vi } from "vitest";
import { repositoryExists } from "@/lib/github/repositoryExists";

describe("repositoryExists", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true on 200", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const result = await repositoryExists({
      owner: "recoupable",
      repo: "sweetman-id-1",
      token: "tok",
    });

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/sweetman-id-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
        }),
      }),
    );
  });

  it("returns false on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    expect(
      await repositoryExists({
        owner: "recoupable",
        repo: "missing",
        token: "tok",
      }),
    ).toBe(false);
  });

  it("returns null on other statuses (auth, rate limit, etc.)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));

    expect(
      await repositoryExists({
        owner: "recoupable",
        repo: "rate-limited",
        token: "tok",
      }),
    ).toBeNull();
  });

  it("returns null on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));

    expect(
      await repositoryExists({
        owner: "recoupable",
        repo: "anything",
        token: "tok",
      }),
    ).toBeNull();
  });
});
