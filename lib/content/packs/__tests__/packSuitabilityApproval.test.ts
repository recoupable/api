import * as modelEvidence from "../getPackModelEvidence";
import { importPackSources } from "../importPackSources";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
afterEach(() => vi.restoreAllMocks());
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
          quote: {
            ...buildReleasePackQuote(brief, deliverables),
            model_readiness: { ready: true, tasks: {} },
            id,
            retry_asset_id: id,
          },
        },
        assets: [{ id, kind: "artwork", ordinal: 0, status: "failed" }],
      };
      vi.mocked(runPackCommand).mockResolvedValue(saved as never);
      await expect(
        processPackOperation("owner", operation, {
          ...approval,
          ...(operation === "retry" ? { asset_id: id } : {}),
        }),
      ).rejects.toThrow(/analysis.*commercial use restricted/i);
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
  it.each(["generate", "retry"] as const)(
    "preserves legacy %s approval with completed analysis and unknown remaining evidence",
    async operation => {
      const { model_readiness: _assessment, ...legacyQuote } = buildReleasePackQuote(
        brief,
        deliverables,
      );
      const saved = {
        job: {
          id,
          revision: 1,
          status: "awaiting_approval",
          brief,
          deliverables,
          production_context: {
            state: "complete",
            audio: { storage_key: "owner/release-packs/song.wav" },
            references: [],
            summary: "Sparse piano and percussion",
            visual_direction: "Cream paper and ink",
            proposed_start_seconds: 0,
            selected_start_seconds: 0,
            duration_seconds: 30,
          },
          quote: {
            ...legacyQuote,
            fingerprint: "legacy-approved-fingerprint",
            id,
            retry_asset_id: id,
          },
        },
        assets: [{ id, kind: "artwork", ordinal: 0, status: "failed" }],
      };
      vi.mocked(runPackCommand).mockResolvedValue(saved as never);
      vi.mocked(checkCreditsAvailable).mockResolvedValue({ kind: "available" } as never);
      await processPackOperation("owner", operation, {
        ...approval,
        ...(operation === "retry" ? { asset_id: id } : {}),
      });
      expect(vi.mocked(runPackCommand).mock.calls.map(call => call[1])).toEqual([
        "read",
        "approve",
      ]);
      expect(saved.job.quote.fingerprint).toBe("legacy-approved-fingerprint");
      expect(start).not.toHaveBeenCalled();
    },
  );
  it("assesses only a targeted retry and omits retained complete analysis", async () => {
    const saved = {
      job: {
        id,
        revision: 1,
        owner_id: "owner",
        brief,
        deliverables,
        production_context: {
          state: "complete",
          audio: { storage_key: "owner/release-packs/song.wav" },
          references: [],
          summary: "Sparse piano and percussion",
          visual_direction: "Cream paper and ink",
          proposed_start_seconds: 0,
          selected_start_seconds: 0,
          duration_seconds: 30,
        },
        quote: {
          sources: { audio: { storage_key: "owner/release-packs/song.wav" }, references: [] },
        },
      },
      assets: [{ id, kind: "artwork", ordinal: 0, status: "failed" }],
    };
    vi.mocked(runPackCommand).mockResolvedValue(saved as never);
    await processPackOperation("owner", "estimate", { job_id: id, asset_id: id });
    const payload = vi
      .mocked(runPackCommand)
      .mock.calls.find(call => call[1] === "estimate")?.[3] as any;
    expect(Object.keys(payload.quote.model_readiness.tasks)).toEqual([
      "image",
      "caption",
      "still_inspection",
    ]);
    expect(importPackSources).not.toHaveBeenCalled();
  });

  it.each(["changed", "expired"])(
    "replays funded running approval after %s evidence without new admission or effects",
    async change => {
      const { model_readiness: _assessment, ...legacyQuote } = buildReleasePackQuote(
        brief,
        deliverables,
      );
      const saved = {
        job: {
          id,
          revision: 1,
          status: "running",
          held_credits: 100,
          brief,
          deliverables,
          quote: { ...legacyQuote, id },
        },
        assets: [],
        dispatch: false,
      };
      vi.mocked(runPackCommand).mockResolvedValue(saved as never);
      const changed = modelEvidence.getPackModelEvidence();
      if (change === "changed") changed.version = "after-approval";
      else changed.tasks.analysis.valid_until = "2000-01-01T00:00:00Z";
      vi.spyOn(modelEvidence, "getPackModelEvidence").mockReturnValue(changed);
      await processPackOperation("owner", "generate", approval);
      expect(vi.mocked(runPackCommand).mock.calls.map(call => call[1])).toEqual([
        "read",
        "approve",
      ]);
      expect(checkCreditsAvailable).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    },
  );
});
