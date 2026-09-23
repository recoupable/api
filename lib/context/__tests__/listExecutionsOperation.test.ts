import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
const { authorize, list } = vi.hoisted(() => ({ authorize: vi.fn(), list: vi.fn() }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: authorize }));
vi.mock("@/lib/supabase/context_requests/listContextRequestExecutions", () => ({
  listContextRequestExecutions: list,
}));
const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";

it("lists a request's trace IDs under the selected authenticated workspace", async () => {
  authorize.mockResolvedValue({ ownerId: owner });
  list.mockResolvedValue([]);
  const rpc = vi.fn();
  const dispatch = vi.fn();
  await expect(
    processContextOperation(
      actor,
      { action: "list_executions", request_id: requestId, organization_id: owner },
      { rpc, dispatch },
    ),
  ).resolves.toEqual({ executions: [] });
  expect(authorize).toHaveBeenCalledWith(actor, owner);
  expect(list).toHaveBeenCalledWith(owner, requestId);
  expect(rpc).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});
