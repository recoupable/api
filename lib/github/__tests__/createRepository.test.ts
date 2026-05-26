import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRepository } from "@/lib/github/createRepository";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";

vi.mock("@/lib/github/getServiceGithubToken", () => ({
  getServiceGithubToken: vi.fn(() => "tok"),
}));

describe("createRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
  });

  it("returns failure when GITHUB_TOKEN is missing", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue(undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await createRepository({ name: "id-1" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/GITHUB_TOKEN/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid names without hitting the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await createRepository({ name: "bad name with spaces" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs to /orgs/recoupable/repos with hard-coded private=true + auto_init=true", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          html_url: "https://github.com/recoupable/id-1",
          clone_url: "https://github.com/recoupable/id-1.git",
          owner: { login: "recoupable" },
          name: "id-1",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await createRepository({ name: "id-1" });

    expect(result).toEqual({
      success: true,
      repoUrl: "https://github.com/recoupable/id-1",
      cloneUrl: "https://github.com/recoupable/id-1.git",
      owner: "recoupable",
      repoName: "id-1",
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/orgs/recoupable/repos");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "id-1",
      private: true,
      auto_init: true,
    });
  });

  it("returns name-conflict error on 422", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 422 }));

    const result = await createRepository({ name: "id-1" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
  });

  it("returns permission-denied error on 403", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));

    const result = await createRepository({ name: "id-1" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permission/i);
  });

  it("returns network-error on fetch rejection", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));

    const result = await createRepository({ name: "id-1" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/network/i);
  });
});
