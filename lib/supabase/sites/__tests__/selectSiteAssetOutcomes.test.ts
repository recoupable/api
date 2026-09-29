import { expect, it, vi } from "vitest";
import { selectSiteAssetOutcomes } from "../selectSiteAssetOutcomes";
const m = vi.hoisted(() => ({ eq: vi.fn(), limit: vi.fn() }));
vi.mock("../siteTable", () => ({ siteTable: () => ({ select: () => ({ eq: m.eq }) }) }));
it("restricts feedback to the requested workspace and reads the last completed review", async () => {
  m.eq.mockReturnValue({ order: () => ({ limit: m.limit }) });
  m.limit.mockResolvedValue({
    data: [
      {
        draft: {
          assets: [
            {
              generation: {
                model: "fal-ai/nano-banana-pro",
                rationale: "character",
                durationMs: 50,
              },
            },
          ],
          production: {
            reviews: [
              { verdict: "revise", issues: [{ module: "assets", detail: "bad", fix: "replace" }] },
              { verdict: "pass", issues: [] },
            ],
          },
        },
      },
    ],
    error: null,
  });
  const outcomes = await selectSiteAssetOutcomes("workspace-1");
  expect(m.eq).toHaveBeenCalledWith("owner_id", "workspace-1");
  expect(m.limit).toHaveBeenCalledWith(8);
  expect(outcomes).toMatchObject([
    { model: "fal-ai/nano-banana-pro", siteVerdict: "pass", assetIssues: [] },
  ]);
});
