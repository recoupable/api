import { describe, it, expect } from "vitest";
import { toTaskUpdates } from "@/lib/projects/toTaskUpdates";

describe("toTaskUpdates", () => {
  it("stamps completion from the server clock and the acting account", () => {
    const updates = toTaskUpdates({ completed: true }, "acct-1");
    expect(updates.completed_by).toBe("acct-1");
    expect(typeof updates.completed_at).toBe("string");
  });

  it("clears both fields when reopening", () => {
    expect(toTaskUpdates({ completed: false }, "acct-1")).toEqual({
      completed_at: null,
      completed_by: null,
    });
  });

  it("leaves completion alone when the body does not mention it", () => {
    const updates = toTaskUpdates({ title: "Renamed" }, "acct-1");
    expect(updates).toEqual({ title: "Renamed" });
  });

  it("maps an explicit null through instead of dropping the field", () => {
    // Clearing a due date has to be distinguishable from not touching it.
    expect(toTaskUpdates({ due_date: null }, "acct-1")).toEqual({ due_date: null });
  });
});
