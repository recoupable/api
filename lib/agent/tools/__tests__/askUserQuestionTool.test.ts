import { describe, it, expect } from "vitest";
import {
  askUserQuestionTool,
  askUserQuestionInputSchema,
} from "@/lib/agent/tools/askUserQuestionTool";

describe("askUserQuestionInputSchema", () => {
  it("accepts a valid single-question payload", () => {
    const result = askUserQuestionInputSchema.safeParse({
      questions: [
        {
          question: "Which model do you want?",
          header: "Model",
          options: [
            { label: "Haiku", description: "Fast" },
            { label: "Sonnet", description: "Balanced" },
          ],
          multiSelect: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty questions list", () => {
    const result = askUserQuestionInputSchema.safeParse({ questions: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 4 questions per payload", () => {
    const q = {
      question: "x?",
      header: "h",
      options: [
        { label: "a", description: "a" },
        { label: "b", description: "b" },
      ],
      multiSelect: false,
    };
    const result = askUserQuestionInputSchema.safeParse({ questions: [q, q, q, q, q] });
    expect(result.success).toBe(false);
  });

  it("rejects a question with fewer than 2 options", () => {
    const result = askUserQuestionInputSchema.safeParse({
      questions: [
        {
          question: "x?",
          header: "h",
          options: [{ label: "only", description: "one" }],
          multiSelect: false,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a header longer than 12 chars", () => {
    const result = askUserQuestionInputSchema.safeParse({
      questions: [
        {
          question: "x?",
          header: "this-header-is-way-too-long",
          options: [
            { label: "a", description: "a" },
            { label: "b", description: "b" },
          ],
          multiSelect: false,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("askUserQuestionTool — server-side wiring", () => {
  it("has no execute (it's a client-side tool the chat UI fulfills)", () => {
    expect(askUserQuestionTool.execute).toBeUndefined();
  });
});

describe("askUserQuestionTool.toModelOutput", () => {
  it("returns a generic message when no output is present", () => {
    expect(askUserQuestionTool.toModelOutput!({ output: undefined } as never)).toEqual({
      type: "text",
      value: "User did not respond to questions.",
    });
  });

  it("formats `declined: true` as a clear decline message", () => {
    const result = askUserQuestionTool.toModelOutput!({
      output: { declined: true },
    } as never);
    expect(result).toMatchObject({
      type: "text",
      value: expect.stringMatching(/declined to answer/i),
    });
  });

  it("formats answered questions as a parseable Q=A summary", () => {
    const result = askUserQuestionTool.toModelOutput!({
      output: {
        answers: {
          "Which model do you want?": "Haiku",
          "Which features?": ["Streaming", "Tools"],
        },
      },
    } as never);
    expect(result).toMatchObject({
      type: "text",
      value: expect.stringContaining(`"Which model do you want?"="Haiku"`),
    });
    expect((result as { value: string }).value).toContain(`"Which features?"="Streaming, Tools"`);
  });
});
