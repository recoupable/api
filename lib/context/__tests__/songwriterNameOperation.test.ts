import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";

vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

const actor = "00000000-0000-4000-8000-000000000001";
const workspace = "00000000-0000-4000-8000-000000000002";

it("saves a name-only songwriter input in the selected workspace without starting research", async () => {
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
      action: "ingest_songwriter_name",
      name: "  Writer Example  ",
      organization_id: workspace,
      idempotency_key: "writer-test",
    },
    { authorize, rpc, dispatch },
  );
  expect(authorize).toHaveBeenCalledWith(actor, workspace);
  expect(rpc).toHaveBeenCalledWith("create_context_songwriter_name_request", {
    p_owner: workspace,
    p_actor: actor,
    p_name: "Writer Example",
    p_key: "writer-test",
  });
  expect("request" in result && result.request?.status).toBe("partial");
  expect(dispatch).not.toHaveBeenCalled();
});

it("rejects malformed songwriter input before authorization or storage", async () => {
  const authorize = vi.fn();
  const rpc = vi.fn();
  await expect(
    processContextOperation(
      actor,
      { action: "ingest_songwriter_name", name: " ", idempotency_key: "writer-test" },
      { authorize, rpc, dispatch: vi.fn() },
    ),
  ).rejects.toThrow();
  expect(authorize).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
