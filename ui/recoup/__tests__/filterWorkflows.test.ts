import { describe, expect, it } from "vitest";
import { filterWorkflows } from "../filterWorkflows";
import features from "../features";

describe("workflow discovery", () => {
  it("shows every workflow by default", () => {
    expect(filterWorkflows("")).toEqual(features);
  });
  it("searches the whole library with trimmed, case-insensitive terms", () => {
    expect(filterWorkflows("  MUSIC VIDEO  ", "All").map(f => f.id)).toEqual(["film"]);
  });
  it("combines category and search and includes intended outputs", () => {
    expect(filterWorkflows("Square cover", "Create").map(f => f.id)).toEqual(["cover"]);
    expect(filterWorkflows("Square cover", "Promote")).toEqual([]);
  });
  it("returns every workflow in All and no results for an unknown term", () => {
    expect(filterWorkflows("", "All")).toEqual(features);
    expect(filterWorkflows("no-such-workflow", "All")).toEqual([]);
  });
});
