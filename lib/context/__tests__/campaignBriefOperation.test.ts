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
