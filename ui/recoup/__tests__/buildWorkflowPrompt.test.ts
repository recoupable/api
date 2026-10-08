import { expect, it } from "vitest";
import { buildWorkflowPrompt } from "../buildWorkflowPrompt";
const feature = {
  title: "Make cover art",
  skill: "recoup-content-make-graphics",
  mode: "cover",
  outputs: ["Square cover"],
};
it("requires real input and bounds the message", () => {
  expect(() => buildWorkflowPrompt(feature, "  ")).toThrow();
  expect(() => buildWorkflowPrompt(feature, "a".repeat(4001))).toThrow();
});
it("carries the selected skill and user's actual brief without pretending generation ran", () => {
  const prompt = buildWorkflowPrompt(feature, "  Sun Room, warm and analogue  ");
  expect(prompt).toContain("recoup-content-make-graphics");
  expect(prompt).toContain("Sun Room, warm and analogue");
  expect(prompt).toContain("example, not my source material");
});

it("uses a complete request for noun-based feature titles", () => {
  expect(buildWorkflowPrompt({ ...feature, title: "Content pack" }, "A new single")).toContain(
    'Help me use the Recoup "Content pack" workflow.',
  );
});
