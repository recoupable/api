import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { createPackRecoverySnapshot } from "./createPackRecoverySnapshot";
import { createPackRecoveryCommandMock } from "./createPackRecoveryCommandMock";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { releasePackWorkflow } from "@/app/workflows/packs/releasePackWorkflow";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import fal from "@/lib/fal/server";
import { generateText } from "ai";
import { composePackMedia } from "../composePackMedia";
import { inspectPackMedia } from "../inspectPackMedia";
import * as evidence from "../getPackModelEvidence";
vi.mock("workflow", () => ({ getWorkflowMetadata: () => ({ workflowRunId: "saved-workflow" }) }));
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({ runPackCommand: vi.fn() }));
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(async ({ key }) => `https://example.invalid/${key}`),
}));
vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({ callFlamingoGenerate: vi.fn() }));
vi.mock("@/lib/fal/server", () => ({
  default: { queue: { submit: vi.fn(), status: vi.fn(), result: vi.fn() } },
}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("../composePackMedia", () => ({ composePackMedia: vi.fn() }));
vi.mock("../inspectPackMedia", () => ({ inspectPackMedia: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());
it("runs actual workflow preparation, accepted polling, local composition and settlement after unrelated evidence changes", async () => {
  const saved = createPackRecoverySnapshot();
  const asset = saved.assets[0];
  const originalConsumed = saved.job.consumed_credits;
  const originalHeld = saved.job.held_credits;
  const originalReceipt = structuredClone(asset.provider_state.image_submission_0);
  const changed = evidence.getPackModelEvidence();
  changed.version = "changed-after-approval";
  changed.tasks.motion.commercial_basis = "restricted";
  changed.tasks.motion.valid_until = "2000-01-01T00:00:00Z";
  // Even a new restriction on this provider cannot resubmit or erase an accepted receipt.
  changed.tasks.image.commercial_basis = "restricted";
  vi.spyOn(evidence, "getPackModelEvidence").mockReturnValue(changed);
  vi.mocked(runPackCommand).mockImplementation(
    createPackRecoveryCommandMock(saved, { accountId: "owner" }),
  );
  vi.mocked(fal.queue.status).mockResolvedValue({ status: "COMPLETED" } as never);
  vi.mocked(fal.queue.result).mockResolvedValue({
    data: { images: [{ url: "https://example.invalid/retained.png" }] },
  } as never);
  vi.mocked(composePackMedia).mockResolvedValue({
    files: [{ storage_key: "owner/release-packs/final.png", content_type: "image/png", bytes: 10 }],
    probe: {},
  });
  vi.mocked(inspectPackMedia).mockResolvedValue({ passed: true, reason: "Synthetic QA" });
  expect(await releasePackWorkflow({ accountId: "owner" }, "job", "asset")).toEqual({
    job_id: "job",
  });
  expect(fal.queue.status).toHaveBeenCalledWith("original-image-route", {
    requestId: "retained",
    logs: false,
  });
  expect(fal.queue.result).toHaveBeenCalledWith("original-image-route", { requestId: "retained" });
  expect(fal.queue.submit).not.toHaveBeenCalled();
  expect(callFlamingoGenerate).not.toHaveBeenCalled();
  expect(generateText).not.toHaveBeenCalled();
  expect(composePackMedia).toHaveBeenCalledOnce();
  expect(inspectPackMedia).toHaveBeenCalledOnce();
  expect(asset.caption).toBe("Retained caption");
  expect(saved.job.quote?.fingerprint).toBe("original-approved-fingerprint");
  expect(saved.job.consumed_credits).toBe(originalConsumed);
  expect(saved.job.held_credits).toBe(originalHeld);
  expect(asset.provider_state.image_submission_0).toMatchObject({
    ...(originalReceipt as Record<string, unknown>),
    state: "complete",
  });
  const commands = vi.mocked(runPackCommand).mock.calls.map(call => call[1]);
  expect(commands.slice(0, 3)).toEqual(["run", "read", "read"]);
  expect(commands.slice(-2)).toEqual(["finish_asset", "settle"]);
  expect(commands).not.toContain("approve");
  expect(commands).not.toContain("claim");
  expect(commands).not.toContain("context");
});

it.each([
  ["actor", { accountId: "wrong-owner" }, "job", "asset"],
  ["organization", { accountId: "owner", organizationId: "other-org" }, "job", "asset"],
  ["job", { accountId: "owner" }, "wrong-job", "asset"],
  ["asset", { accountId: "owner" }, "job", "wrong-asset"],
] as const)(
  "rejects wrong %s targets without mutating persistence",
  async (_label, actor, job, assetId) => {
    const saved = createPackRecoverySnapshot();
    const before = structuredClone(saved);
    const command = createPackRecoveryCommandMock(saved, { accountId: "owner" });
    for (const action of ["phase", "finish_asset"])
      await expect(
        command(actor, action, job, {
          asset_id: assetId,
          phase: "caption",
          value: "wrong",
          status: "completed",
        }),
      ).rejects.toThrow(/Unexpected/);
    expect(saved).toEqual(before);
  },
);
it("mutates and returns the requested asset rather than a hard-coded recovery asset", async () => {
  const saved = createPackRecoverySnapshot();
  saved.job.deliverables = { ...saved.job.deliverables, artwork: 2 };
  if (!saved.job.quote) throw new Error("Fixture requires a quote");
  saved.job.quote = {
    ...saved.job.quote,
    ...buildReleasePackQuote(saved.job.brief, saved.job.deliverables),
  };
  saved.job.consumed_credits = saved.job.quote.credits;
  saved.assets.push({ ...structuredClone(saved.assets[0]), id: "other-asset", ordinal: 1 });
  const command = createPackRecoveryCommandMock(saved, { accountId: "owner" });
  const returned = await command({ accountId: "owner" }, "phase", "job", {
    asset_id: "other-asset",
    phase: "caption",
    value: "Other caption",
  });
  expect(saved.assets[0].provider_state.caption).toBe("Retained caption");
  expect(saved.assets[1].provider_state.caption).toBe("Other caption");
  expect(returned).toEqual(saved);
  expect(returned).not.toBe(saved);
  await expect(command({ accountId: "owner" }, "settle", "job")).rejects.toThrow(/original asset/);
});

it("starts recovery with an accepted charge inside the original quote and asset ceiling", () => {
  const snapshot = createPackRecoverySnapshot();
  const quote = snapshot.job.quote;
  if (!quote) throw new Error("Fixture requires an approved quote");
  const asset = snapshot.assets[0];
  const plan = quote.assets[0];
  expect(asset).toMatchObject({
    credits: plan.credits,
    maximum_usd: plan.maximum_usd,
    billed_credits: plan.credits,
    status: "running",
  });
  expect(asset.provider_state.image_submission_0).toMatchObject({
    state: "accepted",
    charge_credits: plan.credits,
  });
  expect(snapshot.job.consumed_credits).toBe(plan.credits);
  expect(snapshot.job.held_credits).toBe(quote.credits - snapshot.job.consumed_credits);
  expect(snapshot.job.held_credits).toBe(0);
  expect(snapshot.job.consumed_credits).toBeLessThanOrEqual(quote.credits);
});
