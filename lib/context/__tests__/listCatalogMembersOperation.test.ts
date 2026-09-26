import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
const { authorize, list, expand, targets } = vi.hoisted(() => ({
  authorize: vi.fn(),
  list: vi.fn(),
  expand: vi.fn(),
  targets: vi.fn(),
}));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: authorize }));
vi.mock("@/lib/supabase/context_requests/listContextCatalogMembers", () => ({
  listContextCatalogMembers: list,
}));
vi.mock("@/lib/supabase/context_requests/expandContextCatalogMembers", () => ({
  expandContextCatalogMembers: expand,
}));
vi.mock("@/lib/supabase/context_requests/listContextCatalogMemberTargets", () => ({
  listContextCatalogMemberTargets: targets,
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

it("authorizes the selected workspace before expanding a catalog page", async () => {
  authorize.mockResolvedValue({ ownerId: owner });
  const page = {
    catalogId: owner,
    catalogSubjectId: subject,
    members: [],
    nextCursor: null,
    hasMore: false,
  };
  expand.mockResolvedValue(page);
  const dispatch = vi.fn();
  await expect(
    processContextOperation(
      actor,
      {
        action: "expand_catalog_members",
        request_id: request,
        subject_id: subject,
        organization_id: owner,
        limit: 25,
      },
      { rpc: vi.fn(), dispatch },
    ),
  ).resolves.toEqual({ page });
  expect(authorize).toHaveBeenCalledWith(actor, owner);
  expect(expand).toHaveBeenCalledWith(owner, request, subject, undefined, 25);
  expect(dispatch).not.toHaveBeenCalled();
});

it("makes a review-only plan from current expanded catalog members", async () => {
  authorize.mockResolvedValue({ ownerId: owner });
  const recording = "00000000-0000-4000-8000-000000000005";
  targets.mockResolvedValue({
    catalogId: owner,
    catalogSubjectId: subject,
    members: [
      {
        subjectId: recording,
        kind: "recording",
        identityConfirmed: true,
        availableFields: ["isrc"],
        reusableModules: [],
        isrc: "AAA000000001",
      },
    ],
    nextCursor: null,
    hasMore: false,
  });
  const result = await processContextOperation(
    actor,
    {
      action: "plan_catalog_members",
      request_id: request,
      subject_id: subject,
      organization_id: owner,
      module: "musicbrainz",
      limit: 20,
    },
    { rpc: vi.fn(), dispatch: vi.fn() },
  );
  expect(targets).toHaveBeenCalledWith(owner, request, subject, undefined, 20);
  expect(result).toMatchObject({
    collectionPermitted: false,
    plan: [{ subjectId: recording, module: "musicbrainz", state: "blocked" }],
  });
});
