import { beforeEach, expect, it, vi } from "vitest";
import supabase from "@/lib/supabase/serverClient";
import { reserveCreditsOnce } from "../reserveCreditsOnce";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn() } }));
const input = {
  accountId: "123e4567-e89b-42d3-a456-426614174000",
  operationKey: "sites:generation-1:attempt-1",
  creditsToReserve: 300,
};
const reservationId = `hold-v1-${"b".repeat(64)}`;
const held = { state: "held", reservationId, creditsHeld: 300, spendableCredits: 700 };
beforeEach(() => vi.clearAllMocks());

it.each([
  held,
  { state: "reused", reservationId, status: "held", creditsHeld: 300 },
  { state: "reused", reservationId, status: "released", creditsHeld: 300 },
  { state: "insufficient", creditsRequested: 300, spendableCredits: -20 },
])("returns a validated $state receipt", async receipt => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: receipt, error: null } as never);
  await expect(reserveCreditsOnce(input)).resolves.toEqual(receipt);
  expect(supabase.rpc).toHaveBeenCalledWith("reserve_credits_once", {
    p_account_id: input.accountId,
    p_operation_key: input.operationKey,
    p_credits: 300,
  });
});

it("keeps the same operation identity after a lost response without retrying internally", async () => {
  const cause = new Error("Private storage detail");
  vi.mocked(supabase.rpc).mockRejectedValueOnce(cause);
  await expect(reserveCreditsOnce(input)).rejects.toMatchObject({
    name: "CreditReservationNeedsReconciliation",
    cause,
    message: "Credit reservation needs reconciliation; retain the same operation key",
  });
  expect(supabase.rpc).toHaveBeenCalledOnce();
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { state: "reused", reservationId, status: "held", creditsHeld: 300 },
    error: null,
  } as never);
  await expect(reserveCreditsOnce(input)).resolves.toMatchObject({ state: "reused" });
  expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual(vi.mocked(supabase.rpc).mock.calls[1]);
});

it.each([
  null,
  { ...held, creditsHeld: 301 },
  { ...held, spendableCredits: -1 },
  { ...held, reservationId: "hold-v1-short" },
  { ...held, extra: true },
  { state: "insufficient", creditsRequested: 299, spendableCredits: 0 },
  { state: "reused", reservationId, status: "expired", creditsHeld: 300 },
  { state: "pending", reservationId, creditsHeld: 300 },
])("treats an invalid receipt as uncertain: %j", async data => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data, error: null } as never);
  await expect(reserveCreditsOnce(input)).rejects.toMatchObject({
    name: "CreditReservationNeedsReconciliation",
  });
  expect(supabase.rpc).toHaveBeenCalledOnce();
});

it("retains a returned database error as an internal cause", async () => {
  const error = { message: "Credit reservation identity conflict" };
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);
  await expect(reserveCreditsOnce(input)).rejects.toMatchObject({
    name: "CreditReservationNeedsReconciliation",
    cause: error,
  });
});

it.each([
  { operationKey: " " },
  { operationKey: "k".repeat(201) },
  { creditsToReserve: 0 },
  { creditsToReserve: 1.5 },
  { creditsToReserve: Number.MAX_SAFE_INTEGER + 1 },
  { accountId: "invalid" },
  { extra: true },
])("rejects invalid input before touching the wallet: %j", async invalid => {
  await expect(reserveCreditsOnce({ ...input, ...invalid } as never)).rejects.toThrow();
  expect(supabase.rpc).not.toHaveBeenCalled();
});
