import { beforeEach, expect, it, vi } from "vitest";
import { listContextRequestExecutions } from "../listContextRequestExecutions";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
const owner = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const executionId = "00000000-0000-4000-8000-000000000003";
beforeEach(() => vi.clearAllMocks());

it("lists trace IDs and completion counts for a saved request", async () => {
  const rows = [
    {
      executionId,
      policyVersion: "metadata-review-v1",
      createdAt: "2026-09-24T00:00:00Z",
      nodeCount: 3,
      outcomeCount: 2,
    },
  ];
  rpc.mockResolvedValue({ data: rows, error: null });
  await expect(listContextRequestExecutions(owner, request)).resolves.toEqual(rows);
  expect(rpc).toHaveBeenCalledWith("list_context_request_executions", {
    p_owner: owner,
    p_request: request,
  });
});

it("rejects malformed identifiers and invented completion counts", async () => {
  rpc.mockResolvedValue({
    data: [
      {
        executionId,
        policyVersion: "v1",
        createdAt: "2026-09-24T00:00:00Z",
        nodeCount: 1,
        outcomeCount: 3,
      },
    ],
    error: null,
  });
  await expect(listContextRequestExecutions(owner, request)).rejects.toThrow();
  await expect(listContextRequestExecutions("bad", request)).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
});
