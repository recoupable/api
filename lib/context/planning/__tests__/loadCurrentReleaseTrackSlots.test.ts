import { expect, it, vi } from "vitest";
import { loadCurrentReleaseTrackSlots } from "../loadCurrentReleaseTrackSlots";

const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const subjectId = "00000000-0000-4000-8000-000000000004";
const resultId = "00000000-0000-4000-8000-000000000005";
const trackA = "AAAAAAAAAAAAAAAAAAAAAA";
const trackB = "BBBBBBBBBBBBBBBBBBBBBB";
const base = {
  state: "ready",
  releaseId: "CCCCCCCCCCCCCCCCCCCCCC",
  sourceResultId: resultId,
  coverage: "partial",
  collectedSlots: 3,
  reportedTotal: 4,
  linkedSlots: 2,
  unavailableSlots: 1,
};
const first = {
  ...base,
  slots: [
    {
      slotIndex: 0,
      spotifyTrackId: trackA,
      discNumber: 1,
      trackNumber: 1,
      sourceResultId: resultId,
    },
  ],
  nextCursor: 0,
  hasMore: true,
};
const second = {
  ...base,
  slots: [
    {
      slotIndex: 2,
      spotifyTrackId: trackB,
      discNumber: 1,
      trackNumber: 3,
      sourceResultId: resultId,
    },
  ],
  nextCursor: null,
  hasMore: false,
};

it("combines stable request-bound pages and rechecks the current result", async () => {
  const authorize = vi.fn(async () => ({ ownerId: owner }));
  const rpc = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second)
    .mockResolvedValueOnce(first);
  const result = await loadCurrentReleaseTrackSlots(actor, owner, requestId, subjectId, {
    authorize,
    rpc,
  });
  expect(result.slots.map(slot => slot.slotIndex)).toEqual([0, 2]);
  expect(result.unavailableSlots).toBe(1);
  expect(rpc.mock.calls.map(([, args]) => args.p_after_slot)).toEqual([-1, 0, -1]);
  expect(authorize).toHaveBeenCalledTimes(2);
});

it("stops if a later page belongs to a different saved source result", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce({ ...second, sourceResultId: subjectId });
  await expect(
    loadCurrentReleaseTrackSlots(actor, owner, requestId, subjectId, {
      authorize: async () => ({ ownerId: owner }),
      rpc,
    }),
  ).rejects.toThrow("source changed");
  expect(rpc).toHaveBeenCalledTimes(2);
});

it("stops if the current result changes after the final page", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second)
    .mockResolvedValueOnce({ ...first, sourceResultId: subjectId });
  await expect(
    loadCurrentReleaseTrackSlots(actor, owner, requestId, subjectId, {
      authorize: async () => ({ ownerId: owner }),
      rpc,
    }),
  ).rejects.toThrow("source changed");
});

it("rejects missing or incomplete source evidence before any provider handoff", async () => {
  const rpc = vi.fn(async () => ({ state: "needs_reconciliation", slots: [] }));
  await expect(
    loadCurrentReleaseTrackSlots(actor, owner, requestId, subjectId, {
      authorize: async () => ({ ownerId: owner }),
      rpc,
    }),
  ).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
});

it("stops before storage if selected-workspace authorization fails", async () => {
  const rpc = vi.fn();
  await expect(
    loadCurrentReleaseTrackSlots(actor, owner, requestId, subjectId, {
      authorize: async () => {
        throw new Error("Access denied");
      },
      rpc,
    }),
  ).rejects.toThrow("Access denied");
  expect(rpc).not.toHaveBeenCalled();
});

it("rejects a cursor that does not match the last observed position", async () => {
  const rpc = vi.fn(async () => ({ ...first, nextCursor: 12 }));
  await expect(
    loadCurrentReleaseTrackSlots(actor, owner, requestId, subjectId, {
      authorize: async () => ({ ownerId: owner }),
      rpc,
    }),
  ).rejects.toThrow("invalid cursor");
  expect(rpc).toHaveBeenCalledTimes(1);
});

it("rejects a different authorized workspace before reading the selected owner", async () => {
  const rpc = vi.fn();
  await expect(
    loadCurrentReleaseTrackSlots(actor, owner, requestId, subjectId, {
      authorize: async () => ({ ownerId: actor }),
      rpc,
    }),
  ).rejects.toThrow("selected context owner");
  expect(rpc).not.toHaveBeenCalled();
});

it("stops if workspace access changes before the final source recheck", async () => {
  const authorize = vi
    .fn()
    .mockResolvedValueOnce({ ownerId: owner })
    .mockResolvedValueOnce({ ownerId: actor });
  const rpc = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  await expect(
    loadCurrentReleaseTrackSlots(actor, owner, requestId, subjectId, { authorize, rpc }),
  ).rejects.toThrow("selected context owner");
  expect(rpc).toHaveBeenCalledTimes(2);
});
