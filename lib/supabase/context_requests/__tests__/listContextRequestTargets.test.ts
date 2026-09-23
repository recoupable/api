import { beforeEach, expect, it, vi } from "vitest";
import { listContextRequestTargets } from "../listContextRequestTargets";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
const owner = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const subjectId = "00000000-0000-4000-8000-000000000003";

beforeEach(() => vi.clearAllMocks());

it("returns subject-specific evidence for planning", async () => {
  const targets = [
    {
      subjectId,
      kind: "recording",
      identityConfirmed: true,
      availableFields: ["isrc"],
      reusableModules: [],
    },
  ];
  rpc.mockResolvedValue({ data: targets, error: null });
  await expect(listContextRequestTargets(owner, request)).resolves.toEqual(targets);
  expect(rpc).toHaveBeenCalledWith("list_context_request_targets", {
    p_owner: owner,
    p_request: request,
  });
});

it("rejects malformed target evidence and identifiers", async () => {
  rpc.mockResolvedValue({
    data: [
      {
        subjectId,
        kind: "recording",
        identityConfirmed: "true",
        availableFields: ["isrc"],
        reusableModules: [],
      },
    ],
    error: null,
  });
  await expect(listContextRequestTargets(owner, request)).rejects.toThrow();
  await expect(listContextRequestTargets("bad-owner", request)).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
});
