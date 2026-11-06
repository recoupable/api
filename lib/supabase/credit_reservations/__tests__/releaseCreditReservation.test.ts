import { beforeEach, expect, it, vi } from "vitest";
import supabase from "@/lib/supabase/serverClient";
import { releaseCreditReservation } from "../releaseCreditReservation";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn() } }));
const input = {
  accountId: "123e4567-e89b-42d3-a456-426614174000",
  operationKey: "sites:generation-1:attempt-1",
};
const receipt = {
  state: "released",
  reservationId: `hold-v1-${"b".repeat(64)}`,
  creditsHeld: 300,
  creditsReleased: 300,
};
beforeEach(() => vi.clearAllMocks());

it.each(["released", "reused"])("returns a validated %s receipt", async state => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: { ...receipt, state }, error: null } as never);
  await expect(releaseCreditReservation(input)).resolves.toEqual({ ...receipt, state });
  expect(supabase.rpc).toHaveBeenCalledWith("release_credit_reservation", {
    p_account_id: input.accountId,
    p_operation_key: input.operationKey,
  });
});

it("keeps the same operation identity after a lost response without retrying internally", async () => {
  const cause = new Error("Private storage detail");
  vi.mocked(supabase.rpc).mockRejectedValueOnce(cause);
  await expect(releaseCreditReservation(input)).rejects.toMatchObject({
    name: "CreditReservationNeedsReconciliation",
    cause,
  });
  expect(supabase.rpc).toHaveBeenCalledOnce();
});

it.each([
  null,
  { ...receipt, creditsReleased: 299 },
  { ...receipt, state: "settled" },
  { ...receipt, reservationId: "hold-v1-short" },
  { ...receipt, extra: true },
])("treats an invalid receipt as uncertain: %j", async data => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data, error: null } as never);
  await expect(releaseCreditReservation(input)).rejects.toMatchObject({
    name: "CreditReservationNeedsReconciliation",
  });
});

it("retains a returned database error as an internal cause", async () => {
  const error = { message: "Credit reservation was settled" };
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);
  await expect(releaseCreditReservation(input)).rejects.toMatchObject({
    name: "CreditReservationNeedsReconciliation",
    cause: error,
  });
});

it.each([{ operationKey: "" }, { accountId: "invalid" }, { creditsToReserve: 300 }])(
  "rejects invalid input before touching the wallet: %j",
  async invalid => {
    await expect(releaseCreditReservation({ ...input, ...invalid } as never)).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  },
);

it("reports a rolled-back database rejection as definite, not uncertain", async () => {
  const error = { code: "22023", message: "Credit reservation was settled" };
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);
  await expect(releaseCreditReservation(input)).rejects.toMatchObject({
    name: "CreditReservationRejected",
    reason: "Credit reservation was settled",
    cause: error,
    message: "Credit reservation request was rejected; nothing was written",
  });
  expect(supabase.rpc).toHaveBeenCalledOnce();
});

it.each([
  { code: "08006", message: "connection failure" },
  { code: "22023" },
  { code: 22023, message: "numeric code" },
])("keeps any other returned database error uncertain: %j", async error => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);
  await expect(releaseCreditReservation(input)).rejects.toMatchObject({
    name: "CreditReservationNeedsReconciliation",
    cause: error,
  });
});
