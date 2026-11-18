import { importPackSources } from "../importPackSources";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processPackOperation } from "../processPackOperation";
import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { start } from "workflow/api";
vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));
vi.mock("@/lib/artists/getArtists", () => ({ getArtists: vi.fn() }));
vi.mock("@/lib/credits/checkCreditsAvailable", () => ({ checkCreditsAvailable: vi.fn() }));
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({ runPackCommand: vi.fn() }));
vi.mock("../importPackSources", () => ({ importPackSources: vi.fn() }));
vi.mock("../assertPackExecutionReady", () => ({ assertPackExecutionReady: vi.fn() }));
vi.mock("../readPackSnapshot", () => ({ readPackSnapshot: (snapshot: unknown) => snapshot }));
vi.mock("workflow/api", () => ({ start: vi.fn() }));
const id = "00000000-0000-4000-8000-000000000001";
const brief = releasePackBriefSchema.parse({
  artist_name: "Fixture",
  song_title: "Song",
  occasion: "rediscovery",
  audio_url: "https://example.com/song.wav",
  allow_creative_defaults: true,
});
const deliverables = releasePackDeliverablesSchema.parse({});
const approval = { job_id: id, quote_id: id, expected_revision: 1, approved_max_usd: 10 };
beforeEach(() => vi.clearAllMocks());
describe("model suitability before reservation", () => {
  it("refuses unsupported explicit choices before importing sources or saving an estimate", async () => {
    vi.mocked(runPackCommand).mockResolvedValue({
      job: { id, brief: { ...brief, model_choices: { caption: "unsupported" } }, deliverables },
      assets: [],
    } as never);
    await expect(processPackOperation("owner", "estimate", { job_id: id })).rejects.toThrow(
      /no substitution/i,
    );
    expect(vi.mocked(runPackCommand).mock.calls.map(call => call[1])).toEqual(["read"]);
    expect(importPackSources).not.toHaveBeenCalled();
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
  it.each(["generate", "retry"] as const)(
    "refuses %s before credit check, reservation or workflow",
    async operation => {
      const saved = {
        job: {
          id,
          revision: 1,
          status: "awaiting_approval",
          brief,
          deliverables,
          quote: { ...buildReleasePackQuote(brief, deliverables), id, retry_asset_id: id },
        },
        assets: [{ id, status: "failed" }],
      };
      vi.mocked(runPackCommand).mockResolvedValue(saved as never);
      await expect(
        processPackOperation("owner", operation, {
          ...approval,
          ...(operation === "retry" ? { asset_id: id } : {}),
        }),
      ).rejects.toThrow(/model suitability/i);
      expect(vi.mocked(runPackCommand).mock.calls.map(call => call[1])).toEqual(["read"]);
      expect(checkCreditsAvailable).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    },
  );
  it("retains accepted-receipt resume with a legacy quote", async () => {
    const saved = {
      job: { id, revision: 1, status: "uncertain", brief, deliverables, quote: { id } },
      assets: [
        {
          id,
          status: "uncertain",
          provider_state: {
            image_submission_0: {
              state: "accepted",
              request_id: "retained",
              model: "original-route",
            },
          },
        },
      ],
    };
    vi.mocked(runPackCommand).mockResolvedValue(saved as never);
    await processPackOperation("owner", "retry", { ...approval, asset_id: id });
    expect(vi.mocked(runPackCommand).mock.calls.map(call => call[1])).toEqual(["read", "resume"]);
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
});
