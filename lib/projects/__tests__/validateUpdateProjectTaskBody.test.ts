import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateUpdateProjectTaskBody } from "@/lib/projects/validateUpdateProjectTaskBody";

describe("validateUpdateProjectTaskBody", () => {
  it("accepts a single field", () => {
    expect(validateUpdateProjectTaskBody({ completed: true })).toEqual({
      completed: true,
    });
  });

  it("rejects an empty body rather than treating it as a no-op success", () => {
    expect(validateUpdateProjectTaskBody({})).toBeInstanceOf(NextResponse);
  });

  it("rejects a due_date that is not a calendar date", () => {
    expect(validateUpdateProjectTaskBody({ due_date: "2026-09-12T00:00:00Z" })).toBeInstanceOf(
      NextResponse,
    );
  });

  it("rejects a non-UUID assignee", () => {
    expect(validateUpdateProjectTaskBody({ assignee_account_id: "nope" })).toBeInstanceOf(
      NextResponse,
    );
  });

  it("does not accept completed_at or completed_by from the caller", () => {
    const result = validateUpdateProjectTaskBody({
      completed: true,
      completed_at: "1999-01-01T00:00:00Z",
      completed_by: "11111111-1111-1111-1111-111111111111",
    });
    expect(result).toEqual({ completed: true });
  });
});
