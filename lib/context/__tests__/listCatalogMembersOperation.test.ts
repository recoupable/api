import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
const { authorize, list } = vi.hoisted(() => ({ authorize: vi.fn(), list: vi.fn() }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: authorize }));
vi.mock("@/lib/supabase/context_requests/listContextCatalogMembers", () => ({
  listContextCatalogMembers: list,
}));
const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const request = "00000000-0000-4000-8000-000000000003";
const subject = "00000000-0000-4000-8000-000000000004";

it("authorizes the selected workspace before reading catalog members", async () => {
  authorize.mockResolvedValue({ ownerId: owner });
  const page = {
    catalogId: owner,
    subjectId: subject,
    members: [],
    nextCursor: null,
    hasMore: false,
  };
  list.mockResolvedValue(page);
  const dispatch = vi.fn();
  await expect(
    processContextOperation(
      actor,
      {
        action: "list_catalog_members",
        request_id: request,
        subject_id: subject,
        organization_id: owner,
        limit: 25,
      },
      { rpc: vi.fn(), dispatch },
    ),
  ).resolves.toEqual({ page });
  expect(authorize).toHaveBeenCalledWith(actor, owner);
  expect(list).toHaveBeenCalledWith(owner, request, subject, undefined, 25);
  expect(dispatch).not.toHaveBeenCalled();
});
