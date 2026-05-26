import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRepository } from "@/lib/github/createRepository";

describe("createRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid names without hitting the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await createRepository({
      owner: "recoupable",
      name: "bad name with spaces",
      token: "tok",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates an org repo on 201, returning clone url + html url", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          html_url: "https://github.com/recoupable/sweetman-id-1",
          clone_url: "https://github.com/recoupable/sweetman-id-1.git",
          owner: { login: "recoupable" },
          name: "sweetman-id-1",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await createRepository({
      owner: "recoupable",
      name: "sweetman-id-1",
      token: "tok",
    });

    expect(result).toEqual({
      success: true,
      repoUrl: "https://github.com/recoupable/sweetman-id-1",
      cloneUrl: "https://github.com/recoupable/sweetman-id-1.git",
      owner: "recoupable",
      repoName: "sweetman-id-1",
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/orgs/recoupable/repos");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      name: "sweetman-id-1",
      private: true,
      auto_init: true,
    });
  });

  it("returns name-conflict error on 422", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 422 }));

    const result = await createRepository({
      owner: "recoupable",
      name: "sweetman-id-1",
      token: "tok",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
  });

  it("returns permission-denied error on 403", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));

    const result = await createRepository({
      owner: "recoupable",
      name: "sweetman-id-1",
      token: "tok",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permission/i);
  });

  it("returns network-error on fetch rejection", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));

    const result = await createRepository({
      owner: "recoupable",
      name: "sweetman-id-1",
      token: "tok",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/network/i);
  });
});
