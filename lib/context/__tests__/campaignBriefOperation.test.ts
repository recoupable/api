import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";

vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

const actor = "00000000-0000-4000-8000-000000000001";
const workspace = "00000000-0000-4000-8000-000000000002";
const brief = {
  name: "Release campaign",
  goal: "Promote the single",
  audience: "Existing listeners",
  start_date: "2026-10-01",
  end_date: "2026-10-31",
};

it("saves a scoped campaign brief without claiming a promoted subject", async () => {
  const rpc = vi.fn(async () => ({ id: "request", status: "partial" }));
  const dispatch = vi.fn();
  const authorize = vi.fn(async () => ({
    accountId: actor,
    ownerId: workspace,
    organizationId: workspace,
  }));
  const result = await processContextOperation(
    actor,
    {
      action: "ingest_campaign_brief",
      brief,
      organization_id: workspace,
      idempotency_key: "campaign-test",
    },
    { authorize, rpc, dispatch },
  );
  expect(authorize).toHaveBeenCalledWith(actor, workspace);
  expect(rpc).toHaveBeenCalledWith("create_context_campaign_brief_request", {
    p_owner: workspace,
    p_actor: actor,
    p_brief: brief,
    p_key: "campaign-test",
  });
  expect("request" in result && result.request?.status).toBe("partial");
  expect(dispatch).not.toHaveBeenCalled();
});

it("rejects reversed dates and invented campaign fields before storage", async () => {
  const authorize = vi.fn();
  const rpc = vi.fn();
  for (const invalid of [
    { ...brief, end_date: "2026-09-01" },
    { ...brief, claimed_release_id: actor },
  ]) {
    await expect(
      processContextOperation(
        actor,
        { action: "ingest_campaign_brief", brief: invalid, idempotency_key: "campaign-test" },
        { authorize, rpc, dispatch: vi.fn() },
      ),
    ).rejects.toThrow();
  }
  expect(authorize).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

const promoted = [
  {
    request_id: "00000000-0000-4000-8000-000000000011",
    subject_id: "00000000-0000-4000-8000-000000000012",
  },
];

it("forwards channels and already-saved promoted subjects to the database without dispatch", async () => {
  const rpc = vi.fn(async () => ({ id: "request", status: "partial" }));
  const dispatch = vi.fn();
  const authorize = vi.fn(async () => ({
    accountId: actor,
    ownerId: workspace,
    organizationId: workspace,
  }));
  const linked = { ...brief, channels: ["Short-form video", "Radio"], promoted };
  await processContextOperation(
    actor,
    {
      action: "ingest_campaign_brief",
      brief: linked,
      organization_id: workspace,
      idempotency_key: "campaign-links",
    },
    { authorize, rpc, dispatch },
  );
  expect(rpc).toHaveBeenCalledWith("create_context_campaign_brief_request", {
    p_owner: workspace,
    p_actor: actor,
    p_brief: linked,
    p_key: "campaign-links",
  });
  expect(dispatch).not.toHaveBeenCalled();
});

it("rejects raw links, file references and ambiguous promoted entries before authorization", async () => {
  const authorize = vi.fn();
  const rpc = vi.fn();
  for (const invalid of [
    { ...brief, promoted_url: "https://example.com/release" },
    { ...brief, promoted: ["https://example.com/release"] },
    { ...brief, promoted: [{ request_id: "https://example.com/release", subject_id: workspace }] },
    { ...brief, promoted: [{ ...promoted[0], url: "https://example.com/release" }] },
    { ...brief, promoted: [promoted[0], promoted[0]] },
    { ...brief, file_path: "/private/artwork.png" },
    { ...brief, channels: ["file:plan.pdf"] },
    { ...brief, channels: ["TikTok", "tiktok"] },
    { ...brief, channels: Array.from({ length: 11 }, (_, i) => `channel ${i}`) },
  ]) {
    await expect(
      processContextOperation(
        actor,
        { action: "ingest_campaign_brief", brief: invalid, idempotency_key: "campaign-links" },
        { authorize, rpc, dispatch: vi.fn() },
      ),
    ).rejects.toThrow();
  }
  expect(authorize).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

it("forwards a legacy brief without link fields unchanged", async () => {
  const rpc = vi.fn(async () => ({ id: "request", status: "partial" }));
  const authorize = vi.fn(async () => ({
    accountId: actor,
    ownerId: workspace,
    organizationId: workspace,
  }));
  await processContextOperation(
    actor,
    { action: "ingest_campaign_brief", brief, idempotency_key: "campaign-legacy" },
    { authorize, rpc, dispatch: vi.fn() },
  );
  const call = rpc.mock.calls[0] as unknown as [string, { p_brief: Record<string, unknown> }];
  expect(Object.keys(call[1].p_brief).sort()).toEqual(Object.keys(brief).sort());
});
