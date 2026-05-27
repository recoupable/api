import { describe, it, expect, beforeEach, vi } from "vitest";
import { repositoryExists } from "@/lib/github/repositoryExists";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";

vi.mock("@/lib/github/getServiceGithubToken", () => ({
  getServiceGithubToken: vi.fn(() => "tok"),
}));

describe("repositoryExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
  });

  it("returns null when GITHUB_TOKEN is missing", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue(undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await repositoryExists({ repo: "id-1" });

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns true on 200 and calls GET /repos/recoupable/<repo>", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const result = await repositoryExists({ repo: "id-1" });

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/id-1",
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

    expect(await repositoryExists({ repo: "missing" })).toBe(false);
  });

  it("returns null on other statuses (auth, rate limit, etc.)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));

    expect(await repositoryExists({ repo: "rate-limited" })).toBeNull();
  });

  it("returns null on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));

    expect(await repositoryExists({ repo: "anything" })).toBeNull();
  });
});
