import { expect, it, vi } from "vitest";
import { compileJourney } from "../production/compileJourney";
import { generateProductionObject } from "../production/generateProductionObject";
import { validateExperienceContract } from "../production/validateExperienceContract";
import type { SiteSnapshot } from "../schema";
vi.mock("../production/generateProductionObject", () => ({ generateProductionObject: vi.fn() }));
const contract = validateExperienceContract({
  releaseConnection: "The song celebrates choosing a night in.",
  evidence: ["Saved song summary"],
  motivation: "Enjoy funny replies to invitations to go out.",
  payoff: "Read your completed night-in story and play again.",
  capabilities: ["browser-interaction"],
  steps: [
    {
      action: "click",
      target: "Stay in",
      value: "",
      expected: "The first panel appears with the chosen reply.",
      checkpoint: "participate",
    },
    {
      action: "click",
      target: "Finish",
      value: "",
      expected: "The story is complete.",
      checkpoint: "result",
    },
    {
      action: "click",
      target: "Replay",
      value: "",
      expected: "The initial screen returns.",
      checkpoint: "delivery",
    },
  ],
});
const snapshot = {
  design: { experience: { html: "<button>Stay in</button>", css: "", javascript: "" } },
} as SiteSnapshot;
it("compiles literal assertions while preserving the original promised payoff", async () => {
  const steps = contract.steps.map((step, i) => ({
    ...step,
    expected: ["Couch wins", "Your night", "Choose"][i],
  }));
  vi.mocked(generateProductionObject).mockResolvedValue({ steps, payoff: "weaker promise" });
  const result = await compileJourney(snapshot, contract, "account", "site");
  expect(result.steps).toEqual(steps);
  expect(result.payoff).toBe(contract.payoff);
  expect(generateProductionObject).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.any(String),
    expect.objectContaining({ contract, experience: snapshot.design.experience }),
    [],
    "account",
    "site",
  );
});
it("rejects a compiled plan that drops a required download", async () => {
  vi.mocked(generateProductionObject).mockResolvedValue({ steps: contract.steps });
  await expect(
    compileJourney(
      snapshot,
      { ...contract, capabilities: ["browser-interaction", "image-download"] },
      "account",
      "site",
    ),
  ).rejects.toThrow("Missing actual download test");
});

it("repairs prose keyboard instructions before executing a browser journey", async () => {
  const invalid = contract.steps.map((step, i) =>
    i === 0
      ? {
          ...step,
          action: "press",
          target: "Dance floor",
          value: "ArrowLeft; hold for one second, then release.",
        }
      : step,
  );
  const fixed = invalid.map((step, i) =>
    i === 0 ? { ...step, value: "ArrowLeft", holdMs: 1000, waitMs: 9000 } : step,
  );
  vi.mocked(generateProductionObject)
    .mockReset()
    .mockResolvedValueOnce({ steps: invalid })
    .mockResolvedValueOnce({ steps: fixed });
  const result = await compileJourney(snapshot, contract, "account", "site");
  expect(result.steps[0]).toMatchObject({ value: "ArrowLeft", holdMs: 1000, waitMs: 9000 });
  expect(generateProductionObject).toHaveBeenCalledTimes(2);
});
it("stops after a second invalid keyboard plan instead of sending it to the browser", async () => {
  const invalid = contract.steps.map((step, i) =>
    i === 0 ? { ...step, action: "press", value: "Hold left for a while" } : step,
  );
  vi.mocked(generateProductionObject).mockReset().mockResolvedValue({ steps: invalid });
  await expect(compileJourney(snapshot, contract, "account", "site")).rejects.toThrow("keyboard");
  expect(generateProductionObject).toHaveBeenCalledTimes(2);
});
