import { expect, it, vi } from "vitest";
import { listContextCatalogMembers } from "../listContextCatalogMembers";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../callContextRpc", () => ({ callContextRpc: rpc }));
const owner = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const subject = "00000000-0000-4000-8000-000000000003";
const catalog = "00000000-0000-4000-8000-000000000004";

it("reads a bounded owner-scoped catalog page without inferring rights", async () => {
  rpc.mockResolvedValue({
    catalogId: catalog,
    subjectId: subject,
    members: ["AAA000000001"],
    nextCursor: null,
    hasMore: false,
  });
  await expect(
    listContextCatalogMembers(owner, request, subject, undefined, 2),
  ).resolves.toMatchObject({ members: ["AAA000000001"] });
  expect(rpc).toHaveBeenCalledWith("list_context_catalog_members", {
    p_owner: owner,
    p_request: request,
    p_subject: subject,
    p_after_isrc: null,
    p_limit: 2,
  });
});

it("rejects mismatched subject, cursor state, and oversized pages", async () => {
  rpc.mockResolvedValueOnce({
    catalogId: catalog,
    subjectId: owner,
    members: [],
    nextCursor: null,
    hasMore: false,
  });
  await expect(listContextCatalogMembers(owner, request, subject)).rejects.toThrow(/mismatch/);
  rpc.mockResolvedValueOnce({
    catalogId: catalog,
    subjectId: subject,
    members: [],
    nextCursor: "AAA000000001",
    hasMore: false,
  });
  await expect(listContextCatalogMembers(owner, request, subject)).rejects.toThrow(/mismatch/);
  await expect(
    listContextCatalogMembers(owner, request, subject, undefined, 101),
  ).rejects.toThrow();
});
