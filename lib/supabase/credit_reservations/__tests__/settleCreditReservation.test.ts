import { beforeEach, expect, it, vi } from "vitest";
import supabase from "@/lib/supabase/serverClient";
import { settleCreditReservation } from "../settleCreditReservation";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn() } }));
const input = {
  accountId: "123e4567-e89b-42d3-a456-426614174000",
  operationKey: "sites:generation-1:attempt-1",
  creditsToDeduct: 120,
  event: { source: "api" as const, model_id: "fixture", output_tokens: 12 },
};
const receipt = {
  state: "settled",
  reservationId: `hold-v1-${"b".repeat(64)}`,
  eventId: `charge-v1-${"a".repeat(64)}`,
  creditsHeld: 300,
  creditsCharged: 120,
  creditsReleased: 180,
};
beforeEach(() => vi.clearAllMocks());

it.each(["settled", "reused"])("returns a validated %s receipt", async state => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: { ...receipt, state }, error: null } as never);
  await expect(settleCreditReservation(input)).resolves.toEqual({ ...receipt, state });
  expect(supabase.rpc).toHaveBeenCalledWith("settle_credit_reservation", {
    p_account_id: input.accountId,
    p_operation_key: input.operationKey,
    p_credits: 120,
    p_event: input.event,
  });
});

it("treats a lost settlement reply as a possibly committed charge and never retries", async () => {
  const cause = new Error("Private storage detail");
  vi.mocked(supabase.rpc).mockRejectedValueOnce(cause);
  await expect(settleCreditReservation(input)).rejects.toMatchObject({
    name: "CreditChargeNeedsReconciliation",
    cause,
  });
  expect(supabase.rpc).toHaveBeenCalledOnce();
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { ...receipt, state: "reused" },
    error: null,
  } as never);
  await expect(settleCreditReservation(input)).resolves.toMatchObject({ state: "reused" });
  expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual(vi.mocked(supabase.rpc).mock.calls[1]);
});

it.each([
  null,
  { ...receipt, creditsCharged: 121, creditsReleased: 179 },
  { ...receipt, creditsReleased: 0 },
  { ...receipt, eventId: "charge-v1-short" },
  { ...receipt, state: "released" },
  { ...receipt, extra: true },
])("treats an invalid receipt as uncertain: %j", async data => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data, error: null } as never);
  await expect(settleCreditReservation(input)).rejects.toMatchObject({
    name: "CreditChargeNeedsReconciliation",
  });
  expect(supabase.rpc).toHaveBeenCalledOnce();
});

it("retains a returned database error as an internal cause", async () => {
  const error = { message: "Credit settlement exceeds reservation" };
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);
  await expect(settleCreditReservation(input)).rejects.toMatchObject({
    name: "CreditChargeNeedsReconciliation",
    cause: error,
  });
});

it.each([
  { operationKey: " " },
  { creditsToDeduct: 0 },
  { event: { input_tokens: -1 } },
  { event: { extra: true } },
  { accountId: "invalid" },
])("rejects invalid input before touching the wallet: %j", async invalid => {
  await expect(settleCreditReservation({ ...input, ...invalid } as never)).rejects.toThrow();
  expect(supabase.rpc).not.toHaveBeenCalled();
});
