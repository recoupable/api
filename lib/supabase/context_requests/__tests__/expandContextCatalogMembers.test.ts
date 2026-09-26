import { expect, it, vi } from "vitest";
import { expandContextCatalogMembers } from "../expandContextCatalogMembers";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../callContextRpc", () => ({ callContextRpc: rpc }));
const owner = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const subject = "00000000-0000-4000-8000-000000000003";
const recording = "00000000-0000-4000-8000-000000000004";

it("prepares one bounded catalog page of separate recording subjects", async () => {
  rpc.mockResolvedValue({
    catalogId: owner,
    catalogSubjectId: subject,
    members: [{ subjectId: recording, isrc: "AAA000000001" }],
    nextCursor: "AAA000000001",
    hasMore: true,
  });
  await expect(
    expandContextCatalogMembers(owner, request, subject, undefined, 1),
  ).resolves.toMatchObject({
    members: [{ subjectId: recording, isrc: "AAA000000001" }],
  });
  expect(rpc).toHaveBeenCalledWith("expand_context_catalog_members", {
    p_owner: owner,
    p_request: request,
    p_subject: subject,
    p_after_isrc: null,
    p_limit: 1,
  });
});

it("rejects a mismatched subject or inconsistent cursor", async () => {
  rpc.mockResolvedValueOnce({
    catalogId: owner,
    catalogSubjectId: owner,
    members: [],
    nextCursor: null,
    hasMore: false,
  });
  await expect(expandContextCatalogMembers(owner, request, subject)).rejects.toThrow(/mismatch/);
  rpc.mockResolvedValueOnce({
    catalogId: owner,
    catalogSubjectId: subject,
    members: [],
    nextCursor: "AAA000000001",
    hasMore: false,
  });
  await expect(expandContextCatalogMembers(owner, request, subject)).rejects.toThrow(/mismatch/);
  await expect(
    expandContextCatalogMembers(owner, request, subject, undefined, 101),
  ).rejects.toThrow();
});
