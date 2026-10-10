import { expect, it } from "vitest";
import features from "../features";
import { filterWorkflows } from "../filterWorkflows";
import { buildWorkflowPrompt } from "../buildWorkflowPrompt";

const workflows = [
  ["Add a release", "recoup-release-add-release"],
  ["Check my release metadata", "recoup-release-check-metadata"],
  ["Import my catalog", "recoup-catalog-import-catalog"],
  ["Check my song credits", "recoup-song-check-credits"],
  ["Explain this music contract", "recoup-catalog-explain-contract"],
  ["Organize my publishing", "recoup-catalog-organize-publishing"],
];

it.each(workflows)("finds %s in Catalog and hands off its skill and outputs", (title, skill) => {
  const matches = filterWorkflows(title, "Catalog");
  expect(matches).toHaveLength(1);
  const card = matches[0];
  expect(card.skill).toBe(skill);
  expect(card.inputs.length).toBeGreaterThan(0);
  expect(card.outputs.length).toBeGreaterThan(0);
  const prompt = buildWorkflowPrompt(card, "Use the files already in this conversation.");
  expect(prompt).toContain(skill);
  expect(prompt).toContain(card.outputs.join(", "));
  expect(prompt).toContain("Check which tools and source files are available");
});

it("keeps card IDs and ordering unique across the entire gallery", () => {
  expect(new Set(features.map(card => card.id)).size).toBe(features.length);
  expect(new Set(features.map(card => card.number)).size).toBe(features.length);
});
