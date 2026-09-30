import { expect, it } from "vitest";
import { buildRevealSchema } from "../production/buildReveal";
it("exposes only the intended customer milestone fields", () => {
  const reveal = buildRevealSchema.parse({
    concept: "Make a letter",
    assets: [
      {
        name: "Paper",
        type: "image",
        url: "https://example.com/paper.png",
        generation: { requestId: "private", provider: "fal", model: "x" },
      },
    ],
    context: { prompt: "private" },
    credentials: "private",
  });
  expect(reveal).toEqual({
    concept: "Make a letter",
    assets: [{ name: "Paper", type: "image", url: "https://example.com/paper.png" }],
  });
});
