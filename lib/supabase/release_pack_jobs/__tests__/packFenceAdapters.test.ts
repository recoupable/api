import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPackProviderObservations } from "../readPackProviderObservations";
import { runPackCommand } from "../runPackCommand";
import { PackFenceError } from "@/lib/content/packs/fence/PackFenceError";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../serverClient", () => ({ default: { rpc } }));
const id = "00000000-0000-4000-8000-000000000001";
const actor = { accountId: id, packProtocol: 2 as const };
beforeEach(() => rpc.mockReset());
describe("redacted receipt reads", () => {
  it.each([
    null,
    { operations: [{ secret: "must not escape" }], next_cursor: null },
    { operations: [], next_cursor: "AAAAAAAA-0000-4000-8000-000000000001" },
  ])("rejects malformed/unredacted pages without leaking details", async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(readPackProviderObservations(actor, id)).rejects.toBeInstanceOf(PackFenceError);
  });
  it("accepts empty page", async () => {
    const data = { operations: [], next_cursor: null };
    rpc.mockResolvedValue({ data, error: null });
    expect(await readPackProviderObservations(actor, id)).toEqual(data);
  });
});
describe("command failure isolation", () => {
  it.each([1, 2] as const)("preserves protocol %i failure contract", async protocol => {
    const selected = protocol === 2 ? actor : { accountId: id };
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "Insufficient credits" },
    });
    await expect(runPackCommand(selected, "approve", id)).rejects.toThrow(
      protocol === 2 ? "reconciliation" : "Insufficient credits",
    );
    expect(rpc.mock.calls[0][0]).toBe(
      protocol === 2 ? "release_pack_command_v2" : "release_pack_command",
    );
    const original = new Error("transport secret");
    rpc.mockRejectedValue(original);
    const failed = runPackCommand(selected, "settle", id);
    if (protocol === 2) await expect(failed).rejects.toBeInstanceOf(PackFenceError);
    else await expect(failed).rejects.toBe(original);
    rpc.mockResolvedValue({ data: {}, error: null });
    await expect(runPackCommand(selected, "read", id)).rejects.toThrow(
      protocol === 2 ? "Invalid protocol-2" : "Invalid pack",
    );
    rpc.mockResolvedValue({ data: { job: {}, command_expired: true }, error: null });
    await expect(runPackCommand(selected, "settle", id)).rejects.toThrow(
      protocol === 2 ? "reconcile retained" : "inspect saved",
    );
  });
});
