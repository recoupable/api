import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateCodingAgentCallback } from "../validateCodingAgentCallback";

describe("validateCodingAgentCallback", () => {
  describe("valid payloads", () => {
    it("accepts pr_created status with prs", () => {
      const body = {
        threadId: "slack:C123:1234567890.123456",
        status: "pr_created",
        branch: "agent/fix-bug-1234",

        prs: [
          {
            repo: "recoupable/recoup-api",
            number: 42,
            url: "https://github.com/recoupable/recoup-api/pull/42",
            baseBranch: "test",
          },
        ],
      };
      const result = validateCodingAgentCallback(body);
      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual(body);
    });

    it("accepts no_changes status", () => {
      const body = {
        threadId: "slack:C123:1234567890.123456",
        status: "no_changes",
        message: "No files were modified",
      };
      const result = validateCodingAgentCallback(body);
      expect(result).not.toBeInstanceOf(NextResponse);
    });

    it("accepts failed status with message", () => {
      const body = {
        threadId: "slack:C123:1234567890.123456",
        status: "failed",
        message: "Sandbox timed out",
      };
      const result = validateCodingAgentCallback(body);
      expect(result).not.toBeInstanceOf(NextResponse);
    });

    it("accepts updated status", () => {
      const body = {
        threadId: "slack:C123:1234567890.123456",
        status: "updated",
      };
      const result = validateCodingAgentCallback(body);
      expect(result).not.toBeInstanceOf(NextResponse);
    });
  });

  describe("invalid payloads", () => {
    it("rejects missing threadId", () => {
      const body = { status: "no_changes" };
      const result = validateCodingAgentCallback(body);
      expect(result).toBeInstanceOf(NextResponse);
    });

    it("rejects invalid status value", () => {
      const body = { threadId: "slack:C123:123", status: "unknown" };
      const result = validateCodingAgentCallback(body);
      expect(result).toBeInstanceOf(NextResponse);
    });

    it("rejects empty object", () => {
      const result = validateCodingAgentCallback({});
      expect(result).toBeInstanceOf(NextResponse);
    });
  });
});
