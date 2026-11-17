import { foundationImageBytes } from "./foundationImageBytes";
import { expect, it, vi } from "vitest";
import { runPackFoundationBatch } from "../runPackFoundationBatch";
import { foundationFixture } from "./foundationFixture";
import type { PackFoundationRecord } from "../packFoundationSchema";
function setup(artwork = 1) {
  const snapshot = foundationFixture(artwork);
  const actor = { accountId: "owner" };
  const produced: { id: string; references: string[]; binding: unknown }[] = [];
  const services = {
    prepare: vi.fn(async () => ({
      job: structuredClone(snapshot.job),
      assetIds: snapshot.assets.filter(a => a.status === "pending").map(a => a.id),
    })),
    read: vi.fn(async () => structuredClone(snapshot)),
    persist: vi.fn(async (_actor: unknown, _job: unknown, record: PackFoundationRecord) => {
      snapshot.job.production_context = {
        ...(snapshot.job.production_context as object),
        shared_foundation: JSON.parse(JSON.stringify(record)),
      };
    }),
    produce: vi.fn(async (_actor: unknown, job: typeof snapshot.job, id: string) => {
      produced.push({
        id,
        references: job.brief.reference_image_urls,
        binding: job.shared_foundation_binding,
      });
      const asset = snapshot.assets.find(a => a.id === id)!;
      Object.assign(asset, {
        status: "completed",
        attempt: 1,
        caption: "Caption",
        qa: { passed: true },
        files: [
          {
            storage_key: `owner/release-packs/${id}.png`,
            content_type: "image/png",
            bytes: foundationImageBytes().length,
          },
        ],
      });
    }),
    readFile: vi.fn(async () => foundationImageBytes()),
    signFile: vi.fn(async () => "https://example.com/retained.png"),
    settle: vi.fn(async () => undefined),
  };
  return { actor, snapshot, produced, services };
}
it("persists readiness before dependent rendering and gives every dependent the same retained binding", async () => {
  const f = setup();
  const result = await runPackFoundationBatch(
    f.actor,
    "job",
    2,
    { dependentAssetIds: ["video-0", "quote_card-0"] },
    f.services,
  );
  expect(f.produced.map(p => p.id)).toEqual(["artwork-0", "video-0", "quote_card-0"]);
  const dependents = f.produced.slice(1);
  expect(dependents.every(p => p.references.includes("https://example.com/retained.png"))).toBe(
    true,
  );
  expect(dependents[0].binding).toEqual(dependents[1].binding);
  expect(result.foundation.state).toBe("ready");
  expect(f.services.persist.mock.invocationCallOrder.at(-1)).toBeLessThan(
    f.services.produce.mock.invocationCallOrder[1],
  );
  expect(f.services.settle).toHaveBeenCalledOnce();
});
it("reuses persisted JSON plan and actual file hashes on a subsequent read without producing again", async () => {
  const f = setup();
  const selection = { dependentAssetIds: ["video-0"] };
  const first = await runPackFoundationBatch(f.actor, "job", 2, selection, f.services);
  f.services.produce.mockClear();
  const replay = await runPackFoundationBatch(f.actor, "job", 2, selection, f.services);
  expect(replay.foundation).toEqual(first.foundation);
  expect(f.services.produce).not.toHaveBeenCalled();
});
it("zero artwork leaves only declared dependents not-ready and still runs independent assets", async () => {
  const f = setup(0);
  const result = await runPackFoundationBatch(
    f.actor,
    "job",
    2,
    { dependentAssetIds: ["video-0"] },
    f.services,
  );
  expect(result.foundation.state).toBe("none_requested");
  expect(result.blockedAssetIds).toEqual(["video-0"]);
  expect(f.produced.map(p => p.id)).toEqual(["quote_card-0"]);
  expect(f.snapshot.assets.find(a => a.id === "video-0")!.status).toBe("pending");
  expect(f.services.settle).not.toHaveBeenCalled();
  expect(result.settlementDeferred).toBe(true);
});
it("failed foundation admits no dependent work but retains independently eligible work", async () => {
  const f = setup();
  const original = f.services.produce.getMockImplementation()!;
  f.services.produce.mockImplementation(async (actor, job, id) => {
    if (id === "artwork-0") {
      f.snapshot.assets.find(a => a.id === id)!.status = "failed";
      return;
    }
    await original(actor, job, id);
  });
  const result = await runPackFoundationBatch(
    f.actor,
    "job",
    2,
    { dependentAssetIds: ["video-0"] },
    f.services,
  );
  expect(result.blockedAssetIds).toEqual(["video-0"]);
  expect(f.produced.map(p => p.id)).toEqual(["quote_card-0"]);
  expect(f.services.settle).not.toHaveBeenCalled();
});
it("changed retained bytes or direction fails closed before new asset work", async () => {
  const f = setup();
  const selection = { dependentAssetIds: ["video-0"] };
  await runPackFoundationBatch(f.actor, "job", 2, selection, f.services);
  f.services.produce.mockClear();
  f.services.readFile.mockResolvedValue(foundationImageBytes(true));
  const changed = await runPackFoundationBatch(f.actor, "job", 2, selection, f.services);
  expect(changed.error).toBeTruthy();
  expect(f.services.produce).not.toHaveBeenCalled();
  f.snapshot.job.brief.creative_direction = "Changed";
  const stale = await runPackFoundationBatch(f.actor, "job", 2, selection, f.services);
  expect(stale.error).toBeTruthy();
  expect(f.services.produce).not.toHaveBeenCalled();
});
it("waits for both foundation completion and readiness persistence before admitting dependents", async () => {
  const f = setup();
  let releaseArtwork!: () => void;
  let releaseRecord!: () => void;
  const artworkGate = new Promise<void>(resolve => {
    releaseArtwork = resolve;
  });
  const recordGate = new Promise<void>(resolve => {
    releaseRecord = resolve;
  });
  const produce = f.services.produce.getMockImplementation()!;
  const persist = f.services.persist.getMockImplementation()!;
  f.services.produce.mockImplementation(async (actor, job, id) => {
    if (id === "artwork-0") await artworkGate;
    await produce(actor, job, id);
  });
  f.services.persist.mockImplementation(async (actor, job, record) => {
    if (record.state === "ready") await recordGate;
    await persist(actor, job, record);
  });
  const batch = runPackFoundationBatch(
    f.actor,
    "job",
    2,
    { dependentAssetIds: ["video-0", "quote_card-0"] },
    f.services,
  );
  await vi.waitFor(() => expect(f.services.produce).toHaveBeenCalledTimes(1));
  expect(f.produced).toHaveLength(0);
  expect(f.services.settle).not.toHaveBeenCalled();
  releaseArtwork();
  await vi.waitFor(() => expect(f.services.persist).toHaveBeenCalledTimes(2));
  expect(f.produced.map(p => p.id)).toEqual(["artwork-0"]);
  expect(f.services.settle).not.toHaveBeenCalled();
  releaseRecord();
  await batch;
  expect(f.produced).toHaveLength(3);
});
it("missing quoted artwork blocks dependents without minting a replacement", async () => {
  const f = setup();
  f.snapshot.assets = f.snapshot.assets.filter(a => a.kind !== "artwork");
  const result = await runPackFoundationBatch(
    f.actor,
    "job",
    2,
    { dependentAssetIds: ["video-0"] },
    f.services,
  );
  expect(result.foundation.state).toBe("unavailable");
  expect(result.foundation.plan.selection).toBe("missing");
  expect(result.blockedAssetIds).toEqual(["video-0"]);
  expect(f.produced.map(p => p.id)).toEqual(["quote_card-0"]);
});
it("does not settle while an existing foundation claim is still running", async () => {
  const f = setup();
  f.snapshot.assets.find(a => a.kind === "artwork")!.status = "running";
  const result = await runPackFoundationBatch(
    f.actor,
    "job",
    2,
    { dependentAssetIds: [] },
    f.services,
  );
  expect(result.settlementDeferred).toBe(true);
  expect(f.services.settle).not.toHaveBeenCalled();
});
it("rejects unbound retained dependent stages instead of relabeling them with a new foundation", async () => {
  const f = setup();
  f.snapshot.assets.find(a => a.id === "video-0")!.provider_state = {
    images: ["https://example.com/old.png"],
  };
  const result = await runPackFoundationBatch(
    f.actor,
    "job",
    2,
    { dependentAssetIds: ["video-0"] },
    f.services,
  );
  expect(result.status).toBe("needs_reconciliation");
  expect(f.services.produce).not.toHaveBeenCalled();
});
it("persists dependent attempt bindings before production and rejects changed attempts on replay", async () => {
  const f = setup();
  const selection = { dependentAssetIds: ["video-0"] };
  const first = await runPackFoundationBatch(f.actor, "job", 2, selection, f.services);
  expect(first.foundation.dependency_bindings).toEqual([{ asset_id: "video-0", attempt: 1 }]);
  f.services.produce.mockClear();
  f.snapshot.assets.find(a => a.id === "video-0")!.attempt = 2;
  const replay = await runPackFoundationBatch(f.actor, "job", 2, selection, f.services);
  expect(replay.status).toBe("needs_reconciliation");
  expect(f.services.produce).not.toHaveBeenCalled();
});
it("keeps the pack's five-reference ceiling and never drops approved inputs", async () => {
  const f = setup();
  f.snapshot.job.brief.reference_image_urls = Array.from(
    { length: 5 },
    (_, i) => `https://example.com/ref-${i}.png`,
  );
  const { buildReleasePackQuote } = await import("../../buildReleasePackQuote");
  f.snapshot.job.quote = {
    ...f.snapshot.job.quote!,
    ...buildReleasePackQuote(f.snapshot.job.brief, f.snapshot.job.deliverables),
  };
  const result = await runPackFoundationBatch(
    f.actor,
    "job",
    2,
    { dependentAssetIds: ["video-0"] },
    f.services,
  );
  expect(result.status).toBe("needs_reference_selection");
  expect(f.services.prepare).not.toHaveBeenCalled();
  expect(f.services.persist).toHaveBeenLastCalledWith(
    f.actor,
    expect.anything(),
    expect.objectContaining({ blocked_reason: "reference_limit" }),
  );
  expect(f.services.produce).not.toHaveBeenCalled();
  expect(f.snapshot.job.brief.reference_image_urls).toHaveLength(5);
  expect(f.services.settle).not.toHaveBeenCalled();
});
it("adds the foundation within five references only for declared dependents", async () => {
  const f = setup();
  f.snapshot.job.brief.reference_image_urls = Array.from(
    { length: 4 },
    (_, i) => `https://example.com/ref-${i}.png`,
  );
  const { buildReleasePackQuote } = await import("../../buildReleasePackQuote");
  f.snapshot.job.quote = {
    ...f.snapshot.job.quote!,
    ...buildReleasePackQuote(f.snapshot.job.brief, f.snapshot.job.deliverables),
  };
  const result = await runPackFoundationBatch(
    f.actor,
    "job",
    2,
    { dependentAssetIds: ["video-0"] },
    f.services,
  );
  expect(result.status).toBe("batch_finished");
  expect(f.produced.find(p => p.id === "video-0")!.references).toHaveLength(5);
  expect(f.produced.find(p => p.id === "quote_card-0")!.references).toHaveLength(4);
});
it("deduplicates an already retained foundation reference and replays without re-signing completed dependents", async () => {
  const f = setup();
  const artwork = f.snapshot.assets.find(a => a.kind === "artwork")!;
  Object.assign(artwork, {
    status: "completed",
    attempt: 1,
    caption: "Art",
    qa: { passed: true },
    files: [
      {
        storage_key: "owner/release-packs/art.png",
        content_type: "image/png",
        bytes: foundationImageBytes().length,
      },
    ],
  });
  f.snapshot.job.brief.reference_image_urls = [
    "https://example.com/retained.png",
    ...Array.from({ length: 4 }, (_, i) => `https://example.com/ref-${i}.png`),
  ];
  const { buildReleasePackQuote } = await import("../../buildReleasePackQuote");
  f.snapshot.job.quote = {
    ...f.snapshot.job.quote!,
    ...buildReleasePackQuote(f.snapshot.job.brief, f.snapshot.job.deliverables),
  };
  const selection = { dependentAssetIds: ["video-0"] };
  const first = await runPackFoundationBatch(f.actor, "job", 2, selection, f.services);
  expect(first.status).toBe("batch_finished");
  expect(f.produced.find(p => p.id === "video-0")!.references).toHaveLength(5);
  f.services.produce.mockClear();
  f.services.signFile.mockClear();
  f.services.signFile.mockResolvedValue("https://example.com/refreshed.png");
  const replay = await runPackFoundationBatch(f.actor, "job", 2, selection, f.services);
  expect(replay.status).toBe("batch_finished");
  expect(f.services.signFile).not.toHaveBeenCalled();
  expect(f.services.produce).not.toHaveBeenCalled();
});
it("deduplicates the same retained storage file even when signing would return a different URL", async () => {
  const f = setup();
  const artwork = f.snapshot.assets.find(a => a.kind === "artwork")!;
  Object.assign(artwork, {
    status: "completed",
    attempt: 1,
    caption: "Art",
    qa: { passed: true },
    files: [
      {
        storage_key: "owner/release-packs/art.png",
        content_type: "image/png",
        bytes: foundationImageBytes().length,
      },
    ],
  });
  f.snapshot.job.brief.reference_image_urls = Array.from(
    { length: 5 },
    (_, i) => `https://example.com/current-${i}.png`,
  );
  f.snapshot.job.production_context = {
    ...(f.snapshot.job.production_context as object),
    references: [
      { storage_key: "owner/release-packs/art.png" },
      ...Array.from({ length: 4 }, (_, i) => ({ storage_key: `owner/release-packs/ref-${i}.png` })),
    ],
  };
  const { buildReleasePackQuote } = await import("../../buildReleasePackQuote");
  f.snapshot.job.quote = {
    ...f.snapshot.job.quote!,
    ...buildReleasePackQuote(f.snapshot.job.brief, f.snapshot.job.deliverables),
  };
  f.services.signFile.mockResolvedValue("https://example.com/newly-signed-art.png");
  const result = await runPackFoundationBatch(
    f.actor,
    "job",
    2,
    { dependentAssetIds: ["video-0"] },
    f.services,
  );
  expect(result.status).toBe("batch_finished");
  expect(f.services.signFile).not.toHaveBeenCalled();
  expect(f.produced.find(p => p.id === "video-0")!.references).toEqual(
    f.snapshot.job.brief.reference_image_urls,
  );
});
