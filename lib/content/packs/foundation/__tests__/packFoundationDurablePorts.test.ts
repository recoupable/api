import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createPackFoundationServices } from "@/app/workflows/packs/foundation/createPackFoundationServices";
import { runPackFoundationBatch } from "../runPackFoundationBatch";
import { foundationFixture } from "./foundationFixture";
import { foundationImageBytes } from "./foundationImageBytes";
import { createPackFoundationPlan } from "../createPackFoundationPlan";
import { getPackBriefFingerprint } from "../../getPackBriefFingerprint";
import type { PackSnapshot } from "../../packTypes";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  sign: vi.fn(),
  fetch: vi.fn(),
  fal: vi.fn(),
  caption: vi.fn(),
  compose: vi.fn(),
  inspect: vi.fn(),
}));
vi.mock("workflow", () => ({ getWorkflowMetadata: () => ({ workflowRunId: "run" }) }));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: { rpc: mocks.rpc, storage: { from: mocks.from } },
}));
vi.mock("../../fetchPackMedia", () => ({ fetchPackMedia: mocks.fetch }));
vi.mock("../../runPackFalRequest", () => ({ runPackFalRequest: mocks.fal }));
vi.mock("../../composePackMedia", () => ({ composePackMedia: mocks.compose }));
vi.mock("../../inspectPackMedia", () => ({ inspectPackMedia: mocks.inspect }));
vi.mock("@/lib/content/video/generateVideo", () => ({
  HOUSE_VIDEO_MODEL: "minimax/h3-max/image-to-video",
}));
vi.mock("ai", () => ({ generateText: mocks.caption }));
vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({
  callFlamingoGenerate: () => {
    throw new Error("Analysis not authorized in this fixture");
  },
}));
let snapshot: PackSnapshot;
let calls: { action: string; input: Record<string, unknown> }[];
const actor = { accountId: "member", organizationId: "owner" };
const services = () => createPackFoundationServices(actor, "job");
const execute = () =>
  runPackFoundationBatch(actor, "job", 2, { dependentAssetIds: ["video-0"] }, services());
beforeEach(() => {
  vi.resetAllMocks();
  snapshot = foundationFixture();
  snapshot.job.hold_expires_at = new Date(Date.now() + 2 * 3600_000).toISOString();
  calls = [];
  mocks.rpc.mockImplementation(async (_name, args) => {
    expect(args.p_actor).toBe("member");
    expect(args.p_org).toBe("owner");
    expect(args.p_job).toBe("job");
    const { p_action: action, p_input: input } = args;
    calls.push({ action, input });
    if (action === "run") snapshot.job.workflow_run_id = input.workflow_run_id;
    if (action === "context") snapshot.job.production_context = structuredClone(input.value);
    const asset = snapshot.assets.find(a => a.id === input.asset_id);
    let claimed = false;
    if (action === "claim" && asset?.status === "pending") {
      asset.status = "running";
      asset.attempt++;
      claimed = true;
    }
    if (action === "phase") asset!.provider_state[input.phase] = structuredClone(input.value);
    if (action === "finish_asset") Object.assign(asset!, input);
    return { data: structuredClone({ ...snapshot, asset, claimed }), error: null };
  });
  mocks.from.mockReturnValue({ createSignedUrl: mocks.sign });
  mocks.sign.mockImplementation(async key => ({
    data: { signedUrl: `https://fixture.invalid/${key}` },
    error: null,
  }));
  mocks.fetch.mockResolvedValue({ bytes: foundationImageBytes(), contentType: "image/png" });
  mocks.fal.mockImplementation(async input => {
    await input.save(input.key, { state: "complete", request_id: "synthetic" });
    return {
      images: [{ url: `https://fixture.invalid/image-${mocks.fal.mock.calls.length}` }],
      video: { url: "https://fixture.invalid/motion" },
    };
  });
  mocks.caption.mockResolvedValue({ text: "Synthetic caption" });
  mocks.compose.mockImplementation(async (_owner, input) => ({
    files: [
      {
        storage_key: `owner/release-packs/${input.images[0].split("/").at(-1)}.png`,
        content_type: "image/png",
        bytes: foundationImageBytes().length,
      },
    ],
    probe: {},
  }));
  mocks.inspect.mockResolvedValue({ passed: true, reason: "Synthetic review" });
});
it("uses actual steps and helpers, owner/org RPC arguments, retained bytes, and durable readiness before dependent claim", async () => {
  const result = await execute();
  expect(result.status).toBe("batch_finished");
  expect(snapshot.assets.every(a => a.status === "completed")).toBe(true);
  const ready = calls.findIndex(
    c =>
      c.action === "context" &&
      (c.input.value as { shared_foundation?: { state: string } }).shared_foundation?.state ===
        "ready",
  );
  const dependent = calls.findIndex(c => c.action === "claim" && c.input.asset_id === "video-0");
  expect(ready).toBeGreaterThan(-1);
  expect(dependent).toBeGreaterThan(ready);
  expect(result.foundation?.dependency_bindings).toEqual([{ asset_id: "video-0", attempt: 1 }]);
  expect(result.foundation?.files[0].sha256).toBe(
    createHash("sha256").update(foundationImageBytes()).digest("hex"),
  );
  const key = snapshot.assets.find(a => a.kind === "artwork")!.files[0].storage_key;
  expect(mocks.from).toHaveBeenCalledWith("user-files");
  expect(mocks.sign).toHaveBeenCalledWith(key, 3600);
  expect(mocks.fetch).toHaveBeenCalledWith(`https://fixture.invalid/${key}`);
  expect(calls.filter(c => c.action === "settle")).toHaveLength(1);
  const count = mocks.fal.mock.calls.length;
  await execute();
  expect(mocks.fal).toHaveBeenCalledTimes(count);
});
it.each([null, "another-run"])(
  "does not manufacture admission for saved workflow %s",
  async workflow => {
    snapshot.job.workflow_run_id = workflow;
    const result = await execute();
    expect(result.status).toBe("needs_reconciliation");
    expect(result.settlementDeferred).toBe(true);
    expect(calls.map(c => c.action)).toEqual(["read"]);
    expect(mocks.fal).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  },
);
it.each(["approved", "completed"])("rejects non-running admission %s", async status => {
  snapshot.job.status = status;
  await execute();
  expect(calls.map(c => c.action)).toEqual(["read"]);
  expect(mocks.fal).not.toHaveBeenCalled();
});
it("propagates RPC access denial without provider or settlement fallback", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { code: "42501", message: "Pack access denied" },
  });
  expect((await execute()).status).toBe("needs_reconciliation");
  expect(mocks.rpc).toHaveBeenCalledOnce();
  expect(mocks.fal).not.toHaveBeenCalled();
  expect(mocks.sign).not.toHaveBeenCalled();
});
it("fails closed when preparation cannot validate retained audio context", async () => {
  snapshot.job.production_context = { state: "complete", audio: { storage_key: "invalid" } };
  expect((await execute()).status).toBe("needs_reconciliation");
  expect(calls.some(c => c.action === "run")).toBe(true);
  expect(calls.some(c => c.action === "claim" || c.action === "settle")).toBe(false);
  expect(mocks.fal).not.toHaveBeenCalled();
});
it("persists known reference-limit conflict without preparation, provider or guessed settlement", async () => {
  snapshot.job.brief.reference_image_urls = Array.from(
    { length: 5 },
    (_, i) => `https://example.com/${i}.png`,
  );
  snapshot.job.quote!.brief_fingerprint = getPackBriefFingerprint(snapshot.job.brief);
  const result = await execute();
  expect(result.status).toBe("needs_reference_selection");
  expect(result.settlementDeferred).toBe(true);
  expect(calls.some(c => ["run", "claim", "settle"].includes(c.action))).toBe(false);
  expect(mocks.fal).not.toHaveBeenCalled();
  expect(mocks.sign).not.toHaveBeenCalled();
});
it("does not retry an uncertain accepted provider request or dispatch its dependent", async () => {
  mocks.fal.mockImplementation(async input => {
    await input.save(input.key, { state: "submitting", request_id: "accepted" });
    throw new Error("Acknowledgement lost");
  });
  const result = await execute();
  expect(result.status).toBe("needs_reconciliation");
  expect(result.settlementDeferred).toBe(true);
  expect(mocks.fal).toHaveBeenCalledTimes(2); // artwork plus independent quote card, no dependent or automatic retry
  expect(calls.some(c => c.action === "claim" && c.input.asset_id === "video-0")).toBe(false);
  expect(calls.some(c => c.action === "settle")).toBe(false);
});
it("rejects unretained and cross-owner signing inputs before storage", async () => {
  for (const storage_key of [
    "other/release-packs/a.png",
    "owner/release-packs/unretained.png",
    "owner/release-packs/../a.png",
  ])
    await expect(
      services().signFile({ storage_key, content_type: "image/png", bytes: 1 }),
    ).rejects.toThrow();
  expect(mocks.sign).not.toHaveBeenCalled();
});
it("rejects a changed supplied foundation asset before storage fetch", async () => {
  await execute();
  mocks.sign.mockClear();
  mocks.fetch.mockClear();
  const plan = createPackFoundationPlan(snapshot, { dependentAssetIds: ["video-0"] });
  const asset = structuredClone(snapshot.assets.find(a => a.kind === "artwork")!);
  asset.caption = "changed";
  await expect(services().bindFiles(plan, asset)).rejects.toThrow();
  expect(mocks.sign).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("stops on admission-record failure inside existing preparation without downstream effects", async () => {
  const rpc = mocks.rpc.getMockImplementation()!;
  mocks.rpc.mockImplementation(async (name, args) =>
    args.p_action === "run"
      ? { data: null, error: { message: "Run write acknowledgement lost" } }
      : rpc(name, args),
  );
  const result = await execute();
  expect(result.status).toBe("needs_reconciliation");
  expect(result.settlementDeferred).toBe(true);
  expect(calls.map(c => c.action)).toEqual(["read"]);
  expect(mocks.sign).not.toHaveBeenCalled();
  expect(mocks.fal).not.toHaveBeenCalled();
});
it("stops on retained download failure without another provider attempt or settlement guess", async () => {
  mocks.fetch.mockRejectedValue(new Error("Storage download unavailable"));
  const result = await execute();
  expect(result.status).toBe("needs_reconciliation");
  expect(result.settlementDeferred).toBe(true);
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(mocks.fal).toHaveBeenCalledOnce();
  expect(calls.some(c => c.action === "settle")).toBe(false);
  expect(calls.filter(c => c.action === "claim").map(c => c.input.asset_id)).toEqual(["artwork-0"]);
});
it("fails closed when ready-context persistence loses acknowledgement", async () => {
  const rpc = mocks.rpc.getMockImplementation()!;
  mocks.rpc.mockImplementation(async (name, args) => {
    const saved = await rpc(name, args);
    return args.p_action === "context" && args.p_input.value.shared_foundation?.state === "ready"
      ? { data: null, error: { message: "Context acknowledgement lost" } }
      : saved;
  });
  const result = await execute();
  expect(result.status).toBe("needs_reconciliation");
  expect(result.settlementDeferred).toBe(true);
  expect(
    (snapshot.job.production_context as { shared_foundation: { state: string } }).shared_foundation
      .state,
  ).toBe("ready");
  expect(mocks.fal).toHaveBeenCalledOnce();
  expect(calls.some(c => c.action === "settle")).toBe(false);
  expect(calls.filter(c => c.action === "claim").map(c => c.input.asset_id)).toEqual(["artwork-0"]);
});
it("never downloads a retained file's supplied URL and rejects signing metadata drift", async () => {
  await execute();
  const asset = snapshot.assets.find(a => a.kind === "artwork")!;
  asset.files[0].url = "https://untrusted.invalid/ignore-me";
  mocks.fetch.mockClear();
  mocks.sign.mockClear();
  const plan = createPackFoundationPlan(snapshot, { dependentAssetIds: ["video-0"] });
  await services().bindFiles(plan, structuredClone(asset));
  expect(mocks.fetch).toHaveBeenCalledWith(`https://fixture.invalid/${asset.files[0].storage_key}`);
  mocks.sign.mockClear();
  await expect(
    services().signFile({ ...asset.files[0], bytes: asset.files[0].bytes + 1 }),
  ).rejects.toThrow();
  expect(mocks.sign).not.toHaveBeenCalled();
});
it("rejects factory actor/job scope mismatch before any effect", () => {
  expect(() => services().read({ accountId: "other" }, "job")).toThrow("scope mismatch");
  expect(() => services().prepare(actor, "other-job")).toThrow("scope mismatch");
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.sign).not.toHaveBeenCalled();
  expect(mocks.fal).not.toHaveBeenCalled();
});
it("retains zero automatic Workflow retries on every effect and computation port", async () => {
  const steps = await Promise.all([
    import("@/app/workflows/packs/foundation/readPackFoundationStep"),
    import("@/app/workflows/packs/foundation/planPackFoundationStep"),
    import("@/app/workflows/packs/foundation/bindPackFoundationFilesStep"),
    import("@/app/workflows/packs/foundation/persistPackFoundationStep"),
    import("@/app/workflows/packs/foundation/signPackFoundationFileStep"),
    import("@/app/workflows/packs/preparePackStep"),
    import("@/app/workflows/packs/producePackAssetStep"),
    import("@/app/workflows/packs/settleBoundedPackStep"),
  ]);
  for (const module of steps)
    for (const step of Object.values(module)) expect(step.maxRetries).toBe(0);
});

it.each([undefined, "invalid", "2000-01-01T00:00:00Z", "2099-01-01T00:00:00Z"])(
  "rejects signing when hold expiry cannot bound replay: %s",
  async expiry => {
    await execute();
    const file = snapshot.assets.find(a => a.kind === "artwork")!.files[0];
    snapshot.job.hold_expires_at = expiry;
    mocks.sign.mockClear();
    await expect(services().signFile(file)).rejects.toThrow("hold expiry");
    expect(mocks.sign).not.toHaveBeenCalled();
  },
);
it("uses the existing 24-hour reference lifetime beyond the valid two-hour admission window", async () => {
  await execute();
  const file = snapshot.assets.find(a => a.kind === "artwork")!.files[0];
  mocks.sign.mockClear();
  await services().signFile(file);
  expect(mocks.sign).toHaveBeenCalledWith(file.storage_key, 86400);
  const signedUntil = Date.now() + 86400_000;
  expect(signedUntil).toBeGreaterThan(Date.parse(snapshot.job.hold_expires_at as string));
  expect(signedUntil).toBeGreaterThan(Date.now() + 90 * 60_000);
});

it("rejects a hold ending exactly at the signing lifetime boundary", async () => {
  await execute();
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  try {
    snapshot.job.hold_expires_at = new Date(now + 86400_000).toISOString();
    mocks.sign.mockClear();
    await expect(
      services().signFile(snapshot.assets.find(a => a.kind === "artwork")!.files[0]),
    ).rejects.toThrow("hold expiry");
    expect(mocks.sign).not.toHaveBeenCalled();
  } finally {
    clock.mockRestore();
  }
});
