import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";

const { authorize, plan } = vi.hoisted(() => ({ authorize: vi.fn(), plan: vi.fn() }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: authorize }));
vi.mock("../planning/planStoredContextModules", () => ({ planStoredContextModules: plan }));
const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";

it("exposes a read-only plan for the actor's selected workspace without dispatch", async () => {
  authorize.mockResolvedValue({ ownerId: owner });
  plan.mockResolvedValue({ requestId, entry: "song", plan: [], collectionPermitted: false });
  const rpc = vi.fn();
  const dispatch = vi.fn();
  const result = await processContextOperation(
    actor,
    { action: "plan", request_id: requestId, organization_id: owner },
    { rpc, dispatch },
  );
  expect(plan).toHaveBeenCalledWith(actor, owner, requestId);
  expect(result).toMatchObject({ collectionPermitted: false });
  expect(rpc).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});
