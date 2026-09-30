import { expect, it, vi } from "vitest";
import { listContextCatalogMemberTargets } from "../listContextCatalogMemberTargets";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../callContextRpc", () => ({ callContextRpc: rpc }));
const owner = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const subject = "00000000-0000-4000-8000-000000000003";
const recording = "00000000-0000-4000-8000-000000000004";

it("reads a bounded page of request-bound recording targets", async () => {
  rpc.mockResolvedValue({
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
  await expect(
    listContextCatalogMemberTargets(owner, request, subject, undefined, 5),
  ).resolves.toMatchObject({ members: [{ subjectId: recording, isrc: "AAA000000001" }] });
  expect(rpc).toHaveBeenCalledWith("list_context_catalog_member_targets", {
    p_owner: owner,
    p_request: request,
    p_subject: subject,
    p_after_isrc: null,
    p_limit: 5,
  });
});

it("rejects unconfirmed, mismatched, or oversized pages", async () => {
  rpc.mockResolvedValueOnce({
    catalogId: owner,
    catalogSubjectId: owner,
    members: [],
    nextCursor: null,
    hasMore: false,
  });
  await expect(listContextCatalogMemberTargets(owner, request, subject)).rejects.toThrow(
    /mismatch/,
  );
  rpc.mockResolvedValueOnce({
    catalogId: owner,
    catalogSubjectId: subject,
    members: [
      {
        subjectId: recording,
        kind: "recording",
        identityConfirmed: false,
        availableFields: ["isrc"],
        reusableModules: [],
        isrc: "AAA000000001",
      },
    ],
    nextCursor: null,
    hasMore: false,
  });
  await expect(listContextCatalogMemberTargets(owner, request, subject)).rejects.toThrow();
  await expect(
    listContextCatalogMemberTargets(owner, request, subject, undefined, 101),
  ).rejects.toThrow();
});
