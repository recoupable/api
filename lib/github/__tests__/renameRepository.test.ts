import { describe, it, expect, beforeEach, vi } from "vitest";
import { renameRepository } from "@/lib/github/renameRepository";

describe("renameRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid newName without hitting the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await renameRepository({
      owner: "recoupable",
      repo: "sweetman-id-1",
      newName: "bad name",
      token: "tok",
    });

    expect(result.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("PATCHes /repos/{owner}/{repo} with {name} and returns the new URLs on 200", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          html_url: "https://github.com/recoupable/id-1",
          clone_url: "https://github.com/recoupable/id-1.git",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await renameRepository({
      owner: "recoupable",
      repo: "sweetman-id-1",
      newName: "id-1",
      token: "tok",
    });

    expect(result).toEqual({
      success: true,
      cloneUrl: "https://github.com/recoupable/id-1.git",
      repoUrl: "https://github.com/recoupable/id-1",
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/recoupable/sweetman-id-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ name: "id-1" });
  });

  it("returns target-conflict error on 422", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 422 }));

    const result = await renameRepository({
      owner: "recoupable",
      repo: "sweetman-id-1",
      newName: "id-1",
      token: "tok",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
  });

  it("returns source-not-found error on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    const result = await renameRepository({
      owner: "recoupable",
      repo: "sweetman-id-1",
      newName: "id-1",
      token: "tok",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("returns network-error on fetch rejection", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));

    const result = await renameRepository({
      owner: "recoupable",
      repo: "sweetman-id-1",
      newName: "id-1",
      token: "tok",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/network/i);
  });
});
