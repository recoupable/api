import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import {
  validateCreateProjectCommentBody,
  COMMENT_MAX_LENGTH,
} from "@/lib/projects/validateCreateProjectCommentBody";

describe("validateCreateProjectCommentBody", () => {
  it("accepts and trims a comment", () => {
    expect(validateCreateProjectCommentBody({ body: "  hello  " })).toEqual({
      body: "hello",
    });
  });

  it("rejects whitespace only, which the database CHECK would also reject", () => {
    expect(validateCreateProjectCommentBody({ body: "   " })).toBeInstanceOf(NextResponse);
  });

  it("rejects a missing body", () => {
    expect(validateCreateProjectCommentBody({})).toBeInstanceOf(NextResponse);
  });

  it("rejects a comment past the column's length cap", () => {
    const tooLong = { body: "x".repeat(COMMENT_MAX_LENGTH + 1) };
    expect(validateCreateProjectCommentBody(tooLong)).toBeInstanceOf(NextResponse);
  });

  it("accepts a comment exactly at the cap", () => {
    const atCap = { body: "x".repeat(COMMENT_MAX_LENGTH) };
    expect(validateCreateProjectCommentBody(atCap)).toEqual(atCap);
  });
});
