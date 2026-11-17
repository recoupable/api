import { beforeEach, expect, it, vi } from "vitest";
import { runBoundedPackProduction } from "../runBoundedPackProduction";
import { preparePackStep } from "@/app/workflows/packs/preparePackStep";
import { producePackAssetStep } from "@/app/workflows/packs/producePackAssetStep";
import { settlePackStep } from "@/app/workflows/packs/settlePackStep";
import { releasePackWorkflow } from "@/app/workflows/packs/releasePackWorkflow";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { preparePackProduction } from "../preparePackProduction";
import { createPackProductionServices } from "../createPackProductionServices";
import type { PackAsset, PackJob } from "../packTypes";

vi.mock("workflow", () => ({ getWorkflowMetadata: () => ({ workflowRunId: "fixture-run" }) }));
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({ runPackCommand: vi.fn() }));
vi.mock("../preparePackProduction", () => ({ preparePackProduction: vi.fn() }));
vi.mock("../createPackProductionServices", () => ({ createPackProductionServices: vi.fn() }));

const actor = { accountId: "fixture-owner" };
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const services = {
  prepare: preparePackStep,
  produce: producePackAssetStep,
  settle: settlePackStep,
};
let job: PackJob;
let assets: PackAsset[];
let gates: ReturnType<typeof deferred>[];
let dispatched: string[];
let active: number;
let peak: number;
let settlementActive: number[];
let failures: Record<string, "failed" | "uncertain">;

beforeEach(() => {
  vi.resetAllMocks();
  job = {
    id: "pack",
    owner_id: actor.accountId,
    created_by: actor.accountId,
    revision: 1,
    status: "running",
    brief: {
      artist_name: "Fixture",
      song_title: "Song",
      occasion: "release",
      constraints: [],
      audio_url: "https://fixture.invalid/audio",
    },
    deliverables: { video_seconds: 8 },
    quote: null,
    held_credits: 100,
    consumed_credits: 0,
    workflow_run_id: "fixture-run",
    error: null,
    production_context: { state: "complete", summary: "retained analysis" },
  } as PackJob;
  assets = Array.from({ length: 4 }, (_, i) => ({
    id: `asset-${i}`,
    job_id: job.id,
    kind: "quote_card",
    ordinal: i,
    status: "pending",
    attempt: 0,
    credits: 0,
    maximum_usd: 1,
    provider_state: {},
    files: [],
    caption: null,
    qa: null,
    error: null,
  }));
  gates = assets.map(() => deferred());
  dispatched = [];
  active = 0;
  peak = 0;
  settlementActive = [];
  failures = {};
  vi.mocked(preparePackProduction).mockImplementation(async (_actor, prepared) => prepared);
  vi.mocked(runPackCommand).mockImplementation(async (_actor, action, _id, input = {}) => {
    const asset = assets.find(a => a.id === input.asset_id);
    if (action === "claim") {
      const claimed = asset?.status === "pending";
      if (claimed && asset) {
        asset.status = "running";
        asset.attempt++;
      }
      return { job, assets, asset, claimed };
    }
    if (action === "phase" && asset) asset.provider_state[String(input.phase)] = input.value;
    if (action === "finish_asset" && asset) Object.assign(asset, input);
    if (action === "settle") settlementActive.push(active);
    if (!["run", "read", "claim", "phase", "finish_asset", "settle"].includes(action))
      throw new Error(`Unexpected budget or dispatch command: ${action}`);
    return { job, assets };
  });
  vi.mocked(createPackProductionServices).mockImplementation((_actor, prepared, asset) => ({
    phase: async (phase, value) => {
      asset.provider_state[phase] = value;
    },
    generateImages: async () => {
      expect(prepared).toBe(job);
      dispatched.push(asset.id);
      active++;
      peak = Math.max(peak, active);
      asset.provider_state.image_submission_0 = {
        state: "accepted",
        request_id: `receipt-${asset.id}`,
      };
      try {
        await gates[asset.ordinal].promise;
        if (failures[asset.id] === "uncertain") throw new Error("Provider outcome unknown");
        asset.provider_state.image_submission_0 = {
          state: "complete",
          request_id: `receipt-${asset.id}`,
        };
        return ["https://fixture.invalid/image"];
      } finally {
        active--;
      }
    },
    generateMotion: async () => {
      throw new Error("No motion in this fixture");
    },
    caption: async () => "Fixture caption",
    compose: async () => ({
      files: [{ storage_key: asset.id, content_type: "image/png", bytes: 10 }],
      probe: {},
    }),
    inspect: async () => ({
      passed: failures[asset.id] !== "failed",
      reason: "Controlled inspection",
    }),
    finish: async result => {
      Object.assign(asset, result);
    },
  }));
});

it("waits for shared preparation, bounds ready work, refills freed slots and settles after the drain", async () => {
  const preparation = deferred();
  vi.mocked(preparePackProduction).mockImplementation(async () => {
    await preparation.promise;
    return job;
  });
  const run = runBoundedPackProduction(actor, job.id, 2, services);
  await vi.waitFor(() => expect(preparePackProduction).toHaveBeenCalledTimes(1));
  expect(dispatched).toEqual([]);
  preparation.resolve();
  await vi.waitFor(() => expect(dispatched).toEqual(["asset-0", "asset-1"]));
  gates[1].resolve();
  await vi.waitFor(() => expect(dispatched).toEqual(["asset-0", "asset-1", "asset-2"]));
  expect(settlementActive).toEqual([]);
  gates[2].resolve();
  await vi.waitFor(() => expect(dispatched).toHaveLength(4));
  gates[3].resolve();
  await vi.waitFor(() => expect(active).toBe(1));
  expect(settlementActive).toEqual([]);
  gates[0].resolve();
  await expect(run).resolves.toEqual({ job_id: job.id });
  expect(peak).toBe(2);
  expect(settlementActive).toEqual([0]);
  expect(assets.every(a => a.status === "completed")).toBe(true);
  expect(job.held_credits).toBe(100);
});

it("retains completed items, failed inspections and uncertain receipts without automatic retry or another budget", async () => {
  assets[0].status = "completed";
  assets[0].files = [{ storage_key: "retained", content_type: "image/png", bytes: 10 }];
  const completed = structuredClone(assets[0]);
  failures = { "asset-1": "failed", "asset-2": "uncertain" };
  gates.forEach(g => g.resolve());
  await runBoundedPackProduction(actor, job.id, 2, services);
  expect(assets[0]).toEqual(completed);
  expect(assets.map(a => a.status)).toEqual(["completed", "failed", "uncertain", "completed"]);
  expect(assets[2].provider_state.image_submission_0).toEqual({
    state: "accepted",
    request_id: "receipt-asset-2",
  });
  await runBoundedPackProduction(actor, job.id, 2, services);
  expect(dispatched).toEqual(["asset-1", "asset-2", "asset-3"]);
  expect(assets.map(a => a.attempt)).toEqual([0, 1, 1, 1]);
  expect(job.held_credits).toBe(100);
  expect(settlementActive).toEqual([0, 0]);
});

it("uses existing claims to reject duplicate step delivery without a second provider dispatch", async () => {
  const produce = async (...args: Parameters<typeof producePackAssetStep>) => {
    await Promise.all([producePackAssetStep(...args), producePackAssetStep(...args)]);
  };
  const run = runBoundedPackProduction(actor, job.id, 2, { ...services, produce });
  await vi.waitFor(() => expect(dispatched).toHaveLength(2));
  gates.forEach(g => g.resolve());
  await run;
  expect(dispatched).toHaveLength(4);
  expect(new Set(dispatched).size).toBe(4);
  expect(assets.every(a => a.attempt === 1)).toBe(true);
  expect(peak).toBe(2);
  expect(settlementActive).toEqual([0]);
});

it("stops admissions on an unexpected step rejection, drains in-flight work, then settles once", async () => {
  const one = deferred();
  const two = deferred();
  const produce = vi.fn(async (_actor, _job, id: string) => {
    await (id === "asset-0" ? one.promise : two.promise);
  });
  const settle = vi.fn(async () => undefined);
  const run = runBoundedPackProduction(actor, job.id, 2, {
    prepare: async () => ({ job, assetIds: assets.map(a => a.id) }),
    produce,
    settle,
  });
  await vi.waitFor(() => expect(produce).toHaveBeenCalledTimes(2));
  one.reject(new Error("Claim acknowledgement lost"));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(settle).not.toHaveBeenCalled();
  expect(produce).toHaveBeenCalledTimes(2);
  two.resolve();
  await expect(run).resolves.toMatchObject({ job_id: job.id, error: expect.any(String) });
  expect(settle).toHaveBeenCalledExactlyOnceWith(actor, job.id, "Claim acknowledgement lost");
  expect(produce).toHaveBeenCalledTimes(2);
});

it("drains a real production step after another step loses its claim acknowledgement", async () => {
  const claimReply = deferred();
  const command = vi.mocked(runPackCommand).getMockImplementation()!;
  vi.mocked(runPackCommand).mockImplementation(async (...args) => {
    if (args[1] === "claim" && args[3]?.asset_id === "asset-0") {
      await claimReply.promise;
    }
    return command(...args);
  });
  const run = runBoundedPackProduction(actor, job.id, 2, services);
  await vi.waitFor(() => expect(dispatched).toEqual(["asset-1"]));
  claimReply.reject(new Error("Claim reply unavailable"));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(settlementActive).toEqual([]);
  expect(dispatched).toEqual(["asset-1"]);
  gates[1].resolve();
  await expect(run).resolves.toMatchObject({ error: expect.any(String) });
  expect(assets[1].status).toBe("completed");
  expect(dispatched).toEqual(["asset-1"]);
  expect(settlementActive).toEqual([0]);
  expect(runPackCommand).toHaveBeenLastCalledWith(actor, "settle", job.id, {
    error: "Claim reply unavailable",
  });
});

it("does not retry settlement after a successful batch loses its settlement reply", async () => {
  const settle = vi.fn().mockRejectedValue(new Error("Settlement reply unavailable"));
  await expect(
    runBoundedPackProduction(actor, job.id, 2, {
      prepare: async () => ({ job, assetIds: [] }),
      produce: vi.fn(),
      settle,
    }),
  ).rejects.toThrow("Settlement reply unavailable");
  expect(settle).toHaveBeenCalledTimes(1);
});

it("settles preparation failure once without dispatching and does not retry failed settlement", async () => {
  const produce = vi.fn();
  const settle = vi.fn().mockRejectedValue(new Error("Settlement acknowledgement lost"));
  await expect(
    runBoundedPackProduction(actor, job.id, 2, {
      prepare: async () => {
        throw new Error("Preparation uncertain");
      },
      produce,
      settle,
    }),
  ).rejects.toThrow("Settlement acknowledgement lost");
  expect(produce).not.toHaveBeenCalled();
  expect(settle).toHaveBeenCalledExactlyOnceWith(actor, job.id, "Preparation uncertain");
});

it.each([0, -1, 1.5, NaN, Infinity])(
  "rejects invalid fixture bound %s before preparation",
  async bound => {
    const prepare = vi.fn();
    await expect(
      runBoundedPackProduction(actor, job.id, bound, { ...services, prepare }),
    ).rejects.toThrow("positive safe integer");
    expect(prepare).not.toHaveBeenCalled();
    expect(runPackCommand).not.toHaveBeenCalled();
  },
);

it("deduplicates ready IDs and handles an empty ready set without dispatch", async () => {
  const produce = vi.fn();
  const settle = vi.fn();
  await runBoundedPackProduction(actor, job.id, 9, {
    prepare: async () => ({ job, assetIds: ["a", "a", "b"] }),
    produce,
    settle,
  });
  expect(produce.mock.calls.map(c => c[2])).toEqual(["a", "b"]);
  produce.mockClear();
  await runBoundedPackProduction(actor, job.id, 9, {
    prepare: async () => ({ job, assetIds: [] }),
    produce,
    settle,
  });
  expect(produce).not.toHaveBeenCalled();
  expect(settle).toHaveBeenCalledTimes(2);
});

it("leaves the existing production workflow sequential", async () => {
  const run = releasePackWorkflow(actor, job.id);
  await vi.waitFor(() => expect(dispatched).toEqual(["asset-0"]));
  for (let i = 0; i < gates.length; i++) {
    expect(active).toBe(1);
    gates[i].resolve();
    if (i < gates.length - 1) await vi.waitFor(() => expect(dispatched).toHaveLength(i + 2));
  }
  await run;
  expect(peak).toBe(1);
  expect(settlementActive).toEqual([0]);
});
