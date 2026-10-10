import { beforeEach, expect, it, vi } from "vitest";
import { callContextRpc } from "../callContextRpc";
import { processContextOperation } from "@/lib/context/processContextOperation";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const account = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const version = "00000000-0000-4000-8000-000000000003";
beforeEach(() => vi.clearAllMocks());
it("allows scoped source withdrawal through the real database adapter", async () => {
  const receipt = { contract_version: "context-source-withdrawal-v1", already_withdrawn: false };
  rpc.mockResolvedValue({ data: receipt, error: null });
  const result = await processContextOperation(
    account,
    { action: "withdraw_source", request_id: request, source_version_id: version },
    {
      authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
      rpc: callContextRpc,
      dispatch: vi.fn(),
    },
  );
  expect(result).toEqual(receipt);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("withdraw_context_request_source", {
    p_actor: account,
    p_owner: account,
    p_request: request,
    p_source: null,
    p_source_version: version,
  });
});
it("keeps the unscoped withdrawal primitive off the adapter allowlist", async () => {
  await expect(
    callContextRpc("withdraw_context_source", { p_owner: account, p_source: version }),
  ).rejects.toThrow("Unknown context operation");
  expect(rpc).not.toHaveBeenCalled();
});
