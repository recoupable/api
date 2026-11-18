import { expect, it, vi } from "vitest";
import { writeProjectionObservation } from "../writeProjectionObservation";
const input = {
  originRunId: "run",
  originStepId: "step",
  assistantMessageId: "assistant",
  ordinal: 2,
  partIndex: 4,
  original: {
    type: "reasoning-file",
    mediaType: "image/png",
    url: "data:image/png;base64,opaque",
    providerMetadata: { provider: { hidden: "exact" } },
  },
};
it("retains original fields in a candidate that still requires independent journal and stream readback", async () => {
  const chunks: unknown[] = [];
  const write = vi.fn(async chunk => {
    chunks.push(chunk);
  });
  const proof = await writeProjectionObservation(input, write);
  expect(proof.observation.data.original).toEqual(input.original);
  expect(proof.events).toEqual(chunks);
  expect(chunks).toHaveLength(4);
  expect(proof.canonicalWrite).toBe("requires-readback");
  expect(proof.observation.data.fallback.text).toBe(
    "This view cannot display a reasoning attachment.",
  );
});
it.each([0, 1, 2, 3])(
  "does not mint a complete proof when canonical write %i fails",
  async failAt => {
    let index = 0;
    const write = vi.fn(async () => {
      if (index++ === failAt) throw new Error("unknown ACK");
    });
    await expect(writeProjectionObservation(input, write)).rejects.toThrow("unknown ACK");
    expect(write).toHaveBeenCalledTimes(failAt + 1);
  },
);
it("refuses approval semantics instead of minting a projection grant", async () => {
  const write = vi.fn();
  await expect(
    writeProjectionObservation(
      { ...input, original: { type: "tool-approval-response", approved: true } },
      write,
    ),
  ).rejects.toMatchObject({ code: "invalid_observation" });
  expect(write).not.toHaveBeenCalled();
});
it("rejects envelope overhead beyond the observation budget before the first write", async () => {
  const original = {
    type: "custom",
    kind: "provider.kind",
    providerMetadata: { provider: { large: "" } },
  };
  original.providerMetadata.provider.large = "x".repeat(
    1_048_576 - Buffer.byteLength(JSON.stringify(original)) - 32,
  );
  const write = vi.fn();
  await expect(writeProjectionObservation({ ...input, original }, write)).rejects.toMatchObject({
    code: "invalid_observation",
  });
  expect(write).not.toHaveBeenCalled();
});
