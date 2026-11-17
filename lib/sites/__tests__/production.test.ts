import { approvedConcept } from "./conceptFixture";
import { beforeEach, expect, it, vi } from "vitest";
import { selectExperienceConcept } from "../production/selectExperienceConcept";
import { produceSite } from "../production/produceSite";
import type { Site } from "../schema";
vi.mock("../skills/prepareSiteSkill", () => ({
  prepareSiteSkill: vi.fn(async () => ({
    name: "recoup-content-build-sites",
    revision: "pinned",
    referenceIds: [1, 2],
  })),
}));
vi.mock("../production/selectExperienceConcept", () => ({
  selectExperienceConcept: vi.fn().mockResolvedValue({ name: "Selected" }),
}));
const m = vi.hoisted(() => ({
  collect: vi.fn(),
  direct: vi.fn(),
  assets: vi.fn(),
  build: vi.fn(),
  review: vi.fn(),
  select: vi.fn(),
  authorize: vi.fn(),
}));
vi.mock("@/lib/supabase/sites/selectSite", () => ({ selectSite: m.select }));
vi.mock("../authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: m.authorize }));
vi.mock("../production/collectReleaseContext", () => ({ collectReleaseContext: m.collect }));
vi.mock("../production/directExperience", () => ({ directExperience: m.direct }));
vi.mock("../production/produceAssets", () => ({ produceAssets: m.assets }));
vi.mock("../production/buildExperience", () => ({ buildExperience: m.build }));
vi.mock("../production/reviewExperience", () => ({ reviewExperience: m.review }));
const site = {
  id: "site",
  owner_id: "workspace",
  revision: 3,
  assets: [],
  draft: null,
} as unknown as Site;
beforeEach(() => {
  vi.resetAllMocks();
  m.select.mockResolvedValue(site);
  vi.mocked(selectExperienceConcept).mockResolvedValue(approvedConcept);
  m.collect.mockResolvedValue({ music: { status: "unavailable" } });
  m.direct.mockResolvedValue({ concept: "A listening garden" });
  m.assets.mockResolvedValue([]);
  m.build.mockResolvedValue({ design: { headline: "Garden" } });
  m.review.mockResolvedValue({ verdict: "pass", issues: [] });
});
it("runs research, direction, real assets, implementation and review in order", async () => {
  const result = await produceSite(site, "", "account", "saved-brief", approvedConcept);
  expect(m.collect).toHaveBeenCalledWith(site, "account", "saved-brief");
  expect(m.direct).toHaveBeenCalledWith(site, "", expect.anything(), "account", approvedConcept);
  expect(m.build.mock.calls[0][3]).toEqual([]);
  expect(result.production.reviews).toHaveLength(1);
  expect(result.production.status).toBe("reviewed");
});
it("revises once with concrete review feedback and keeps both reviews", async () => {
  m.review.mockResolvedValueOnce({
    verdict: "revise",
    issues: [{ detail: "Mobile start button clipped" }],
  });
  const result = await produceSite(site, "", "account", "saved-brief", approvedConcept);
  expect(m.build).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(m.build.mock.calls[1])).toContain("Mobile start button clipped");
  expect(result.production.reviews).toHaveLength(2);
});
it("stops endless repairs after two attempts and preserves the original stored content", async () => {
  let reviews = 0;
  m.review.mockImplementation(async () => {
    if (++reviews > 4) throw new Error("Synthetic runaway sentinel");
    return { verdict: "revise", issues: [{ module: "implementation", detail: "Still broken" }] };
  });
  const before = structuredClone(site);
  await expect(produceSite(site, "", "account", undefined, approvedConcept)).rejects.toMatchObject({
    status: 422,
    message: expect.stringContaining("repair attempt limit"),
  });
  expect(m.build).toHaveBeenCalledTimes(3);
  expect(m.review).toHaveBeenCalledTimes(3);
  expect(site).toEqual(before);
});
it("stops an expired repair window before the next review", async () => {
  let time = 1000;
  const spy = vi.spyOn(Date, "now").mockImplementation(() => time);
  m.review.mockResolvedValueOnce({
    verdict: "revise",
    issues: [{ module: "implementation", detail: "Broken" }],
  });
  m.build
    .mockResolvedValueOnce({ design: { headline: "Initial" } })
    .mockImplementationOnce(async () => {
      time += 20 * 60 * 1000;
      return { design: { headline: "Late" } };
    });
  try {
    await expect(
      produceSite(site, "", "account", undefined, approvedConcept),
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining("repair time limit") });
    expect(m.review).toHaveBeenCalledOnce();
    expect(m.build).toHaveBeenCalledTimes(2);
  } finally {
    spy.mockRestore();
  }
});
it("stops on a revision change before starting another repair", async () => {
  m.review.mockResolvedValueOnce({
    verdict: "revise",
    issues: [{ module: "implementation", detail: "Broken" }],
  });
  m.select.mockResolvedValue({ ...site, revision: 4 });
  await expect(produceSite(site, "", "account", undefined, approvedConcept)).rejects.toMatchObject({
    status: 409,
  });
  expect(m.build).toHaveBeenCalledOnce();
});
it("stops deleted sites before starting another repair", async () => {
  m.select.mockResolvedValue(null);
  await expect(produceSite(site, "", "account", undefined, approvedConcept)).rejects.toMatchObject({
    status: 409,
  });
  expect(m.build).toHaveBeenCalledOnce();
});
it("stops when workspace access is revoked", async () => {
  m.authorize.mockRejectedValue(new Error("Access revoked"));
  await expect(produceSite(site, "", "account", undefined, approvedConcept)).rejects.toThrow(
    "Access revoked",
  );
  expect(m.build).toHaveBeenCalledOnce();
});
it("asset failures stop before code generation rather than inventing asset URLs", async () => {
  m.assets.mockRejectedValue(new Error("Image provider unavailable"));
  await expect(produceSite(site, "", "account", undefined, approvedConcept)).rejects.toThrow(
    "Image provider unavailable",
  );
  expect(m.build).not.toHaveBeenCalled();
});

it("routes asset feedback to asset production without changing direction", async () => {
  m.review.mockResolvedValueOnce({
    verdict: "revise",
    issues: [{ module: "assets", detail: "Blurry scene" }],
  });
  await produceSite(site, "", "account", undefined, approvedConcept);
  expect(m.assets).toHaveBeenCalledTimes(2);
  expect(m.direct).toHaveBeenCalledTimes(1);
  expect(m.assets.mock.calls[1][3]).toContain("Blurry scene");
});
it.each(["revise", "pass"])(
  "keeps direction rejection needs-review even with a %s verdict",
  async verdict => {
    m.review.mockResolvedValueOnce({
      verdict,
      issues: [{ module: "direction", detail: "No fan payoff" }],
    });
    const result = await produceSite(site, "", "account", undefined, approvedConcept);
    expect(m.direct).toHaveBeenCalledTimes(1);
    expect(m.assets).toHaveBeenCalledTimes(1);
    expect(m.build).toHaveBeenCalledTimes(1);
    expect(m.review).toHaveBeenCalledTimes(1);
    expect(result.production.status).toBe("needs-review");
  },
);
it("selects a concept inside production when the client omits it", async () => {
  await produceSite(site, "", "account");
  expect(m.collect).toHaveBeenCalledOnce();
  expect(m.direct).toHaveBeenCalledWith(site, "", expect.anything(), "account", expect.anything());
});

it("stops if ownership changed without authorizing work in the replacement workspace", async () => {
  m.select.mockResolvedValue({ ...site, owner_id: "different-workspace" });
  await expect(produceSite(site, "", "account", undefined, approvedConcept)).rejects.toMatchObject({
    status: 409,
  });
  expect(m.authorize).not.toHaveBeenCalled();
  expect(m.build).toHaveBeenCalledOnce();
});
it("preserves credit blocks instead of beginning another repair", async () => {
  m.review.mockResolvedValue({ verdict: "revise", blocked: "credits", issues: [] });
  await expect(produceSite(site, "", "account", undefined, approvedConcept)).rejects.toMatchObject({
    status: 402,
  });
  expect(m.build).toHaveBeenCalledOnce();
});

it.each(["revision", "deleted", "access"])(
  "rechecks %s after a successful first repair",
  async change => {
    m.review.mockResolvedValueOnce({
      verdict: "revise",
      issues: [{ module: "implementation", detail: "Broken" }],
    });
    m.select
      .mockResolvedValueOnce(site)
      .mockResolvedValue(
        change === "deleted" ? null : change === "revision" ? { ...site, revision: 4 } : site,
      );
    if (change === "access")
      m.authorize.mockResolvedValueOnce(undefined).mockRejectedValue(new Error("Access revoked"));
    await expect(produceSite(site, "", "account", undefined, approvedConcept)).rejects.toThrow();
    expect(m.build).toHaveBeenCalledTimes(2);
    expect(m.select).toHaveBeenCalledTimes(2);
    expect(m.review).toHaveBeenCalledOnce();
  },
);
