import { describe, it, expect } from "vitest";
import { filterNewTaskUsageEvents } from "../filterNewTaskUsageEvents";

describe("filterNewTaskUsageEvents", () => {
  it("returns all current events when baseline is empty", () => {
    const current = [{ toolCallId: "a" }, { toolCallId: "b" }];
    expect(filterNewTaskUsageEvents(current, [])).toEqual(current);
  });

  it("drops events already present in the baseline by toolCallId", () => {
    const baseline = [{ toolCallId: "a" }];
    const current = [{ toolCallId: "a" }, { toolCallId: "b" }];
    expect(filterNewTaskUsageEvents(current, baseline)).toEqual([{ toolCallId: "b" }]);
  });
});
