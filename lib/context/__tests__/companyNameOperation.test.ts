import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";

vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

const actor = "00000000-0000-4000-8000-000000000001";
const workspace = "00000000-0000-4000-8000-000000000002";

it("saves an unresolved company name in the selected workspace without starting research", async () => {
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
      action: "ingest_company_name",
      name: "  Example Records  ",
      organization_id: workspace,
      idempotency_key: "company-test",
    },
    { authorize, rpc, dispatch },
  );
  expect(authorize).toHaveBeenCalledWith(actor, workspace);
  expect(rpc).toHaveBeenCalledWith("create_context_company_name_request", {
    p_owner: workspace,
    p_actor: actor,
    p_name: "Example Records",
    p_key: "company-test",
  });
  expect("request" in result && result.request?.status).toBe("partial");
  expect(dispatch).not.toHaveBeenCalled();
});

it("rejects an empty company name before storage", async () => {
  const authorize = vi.fn();
  const rpc = vi.fn();
  await expect(
    processContextOperation(
      actor,
      { action: "ingest_company_name", name: " ", idempotency_key: "company-test" },
      { authorize, rpc, dispatch: vi.fn() },
    ),
  ).rejects.toThrow();
  expect(authorize).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
