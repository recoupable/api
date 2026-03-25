import { describe, it, expect } from "vitest";
import { parseMentionArgs } from "../parseMentionArgs";
import { DEFAULT_CONTENT_TEMPLATE } from "@/lib/content/contentTemplates";

describe("parseMentionArgs", () => {
  const UUID = "1873859c-dd37-4e9a-9bac-80d3558527a9";

  it("parses a plain artist account ID", () => {
    const result = parseMentionArgs(UUID);
    expect(result.artistAccountId).toBe(UUID);
    expect(result.template).toBe(DEFAULT_CONTENT_TEMPLATE);
  });

  it("strips Slack user mention prefix from text", () => {
    const result = parseMentionArgs(`<@U0ABC123> ${UUID}`);
    expect(result.artistAccountId).toBe(UUID);
    expect(result.template).toBe(DEFAULT_CONTENT_TEMPLATE);
  });

  it("strips multiple Slack mentions before the artist ID", () => {
    const result = parseMentionArgs(`<@U0ABC123> <@U9999999> ${UUID}`);
    expect(result.artistAccountId).toBe(UUID);
    expect(result.template).toBe(DEFAULT_CONTENT_TEMPLATE);
  });

  it("parses template after artist ID with mention prefix", () => {
    const result = parseMentionArgs(`<@U0ABC123> ${UUID} my-template`);
    expect(result.artistAccountId).toBe(UUID);
    expect(result.template).toBe("my-template");
  });

  it("parses batch after artist ID with mention prefix", () => {
    const result = parseMentionArgs(`<@U0ABC123> ${UUID} batch=5`);
    expect(result.artistAccountId).toBe(UUID);
    expect(result.batch).toBe(5);
  });

  it("parses lipsync flag with mention prefix", () => {
    const result = parseMentionArgs(`<@U0ABC123> ${UUID} lipsync`);
    expect(result.artistAccountId).toBe(UUID);
    expect(result.lipsync).toBe(true);
  });

  it("parses all options together with mention prefix", () => {
    const result = parseMentionArgs(`<@U0ABC123> ${UUID} my-template batch=3 lipsync`);
    expect(result.artistAccountId).toBe(UUID);
    expect(result.template).toBe("my-template");
    expect(result.batch).toBe(3);
    expect(result.lipsync).toBe(true);
  });

  it("strips mentions with mixed-case IDs", () => {
    const result = parseMentionArgs(`<@U06d5FLHYQZ> ${UUID}`);
    expect(result.artistAccountId).toBe(UUID);
    expect(result.template).toBe(DEFAULT_CONTENT_TEMPLATE);
  });

  it("strips mentions with lowercase IDs", () => {
    const result = parseMentionArgs(`<@u0abc123> ${UUID}`);
    expect(result.artistAccountId).toBe(UUID);
  });
});
