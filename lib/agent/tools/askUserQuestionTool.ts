import { tool, type UIToolInvocation } from "ai";
import { z } from "zod";

const optionSchema = z.object({
  label: z.string().describe("1-5 words, concise choice text"),
  description: z.string().describe("Explanation of trade-offs/implications"),
});

const questionSchema = z.object({
  question: z.string().describe("The complete question to ask, ends with '?'"),
  header: z.string().max(12).describe("Short label for tab/chip display"),
  options: z.array(optionSchema).min(2).max(4),
  multiSelect: z.boolean().default(false),
});

export const askUserQuestionInputSchema = z.object({
  questions: z.array(questionSchema).min(1).max(4),
});

export type AskUserQuestionInput = z.infer<typeof askUserQuestionInputSchema>;

// Output is filled in by the chat UI after the user answers. Either:
//   - `{ answers: { [question]: string | string[] } }` — keyed by question text
//   - `{ declined: true }` — user dismissed the question component
const answerValueSchema = z.string().or(z.array(z.string()));
const askUserQuestionOutputSchema = z
  .object({ answers: z.record(z.string(), answerValueSchema) })
  .or(z.object({ declined: z.literal(true) }));

export type AskUserQuestionOutput = z.infer<typeof askUserQuestionOutputSchema>;

/**
 * `ask_user_question` — client-side tool for pausing the agent loop to
 * collect human input. The model emits a tool-call with the question
 * schema; `streamText` halts because there's no server `execute`, the
 * chat UI renders the question UI, collects answers, and submits them
 * back to the next workflow request as a `tool-output-available` part
 * inside `messages`. The next workflow turn picks up where this one
 * left off — no WDK pause/resume hook needed.
 *
 * `toModelOutput` formats the (eventual) user answers into a single
 * text block the model can parse on the next turn.
 */
export const askUserQuestionTool = tool({
  description: `Use this tool when you need to ask the user questions during execution. This allows you to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices as you work
4. Offer choices to the user about what direction to take.

Usage notes:
- Users will always be able to select "Other" to provide custom text input
- Use multiSelect: true to allow multiple answers to be selected for a question
- If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label
- Questions appear as tabs; users navigate between them before submitting`,
  inputSchema: askUserQuestionInputSchema,
  outputSchema: askUserQuestionOutputSchema,
  // NO execute: this is a client-side tool. streamText halts the run after
  // emitting the tool-call; the chat UI fulfills it asynchronously.
  toModelOutput: output => {
    if (!output) {
      return { type: "text", value: "User did not respond to questions." };
    }

    if ("declined" in output && output.declined) {
      return {
        type: "text",
        value:
          "User declined to answer questions. You should continue without this information or ask in a different way.",
      };
    }

    if ("answers" in output) {
      const formatted = Object.entries(output.answers)
        .map(([question, answer]) => {
          const value = Array.isArray(answer) ? answer.join(", ") : answer;
          return `"${question}"="${value}"`;
        })
        .join(", ");
      return {
        type: "text",
        value: `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`,
      };
    }

    return { type: "text", value: "User responded to questions." };
  },
});

export type AskUserQuestionToolUIPart = UIToolInvocation<typeof askUserQuestionTool>;
