import { beforeEach, expect, it, vi } from "vitest";
import supabase from "@/lib/supabase/serverClient";
import { recordCreditChargeOnce } from "../recordCreditChargeOnce";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn() } }));
const input = {
  accountId: "123e4567-e89b-42d3-a456-426614174000",
  operationKey: "context:attempt-1:charge-v1",
  creditsToDeduct: 100,
  event: { source: "api" as const, model_id: "fixture" },
};
const receipt = { state: "charged", eventId: `charge-v1-${"a".repeat(64)}`, creditsCharged: 100 };
beforeEach(() => vi.clearAllMocks());

it.each(["charged", "reused"])("returns a validated %s receipt", async state => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: { ...receipt, state }, error: null } as never);
  await expect(recordCreditChargeOnce(input)).resolves.toEqual({ ...receipt, state });
  expect(supabase.rpc).toHaveBeenCalledWith("record_credit_charge_once", {
    p_account_id: input.accountId,
    p_operation_key: input.operationKey,
    p_amount: 100,
    p_event: input.event,
  });
});

it("reuses the same operation identity after a lost response without retrying internally", async () => {
  const cause = new Error("Private storage detail");
  vi.mocked(supabase.rpc).mockRejectedValueOnce(cause);
  await expect(recordCreditChargeOnce(input)).rejects.toMatchObject({
    name: "CreditChargeNeedsReconciliation",
    cause,
    message: "Credit charge needs reconciliation; retain the same operation key",
  });
  expect(supabase.rpc).toHaveBeenCalledOnce();
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { ...receipt, state: "reused" },
    error: null,
  } as never);
  await expect(recordCreditChargeOnce(input)).resolves.toMatchObject({ state: "reused" });
  expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual(vi.mocked(supabase.rpc).mock.calls[1]);
});

it.each([null, { ...receipt, creditsCharged: 101 }, { ...receipt, state: "pending" }])(
  "treats an invalid receipt as uncertain",
  async data => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data, error: null } as never);
    await expect(recordCreditChargeOnce(input)).rejects.toMatchObject({
      name: "CreditChargeNeedsReconciliation",
    });
    expect(supabase.rpc).toHaveBeenCalledOnce();
  },
);

it("retains a returned database error as an internal cause", async () => {
  const error = { message: "Private database detail" };
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);
  await expect(recordCreditChargeOnce(input)).rejects.toMatchObject({
    name: "CreditChargeNeedsReconciliation",
    cause: error,
  });
});

it.each([
  { operationKey: " " },
  { creditsToDeduct: -1 },
  { creditsToDeduct: Number.MAX_SAFE_INTEGER + 1 },
  { event: { input_tokens: -1 } },
  { event: { extra: true } },
  { accountId: "invalid" },
])("rejects invalid input before touching the wallet: %j", async invalid => {
  await expect(recordCreditChargeOnce({ ...input, ...invalid } as never)).rejects.toThrow();
  expect(supabase.rpc).not.toHaveBeenCalled();
});
