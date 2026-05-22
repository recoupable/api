import { streamText, stepCountIs, tool, type LanguageModelUsage, type ModelMessage } from "ai";
import { z } from "zod";
import { buildSubagentTools } from "@/lib/agent/tools/buildSubagentTools";
import { getSubagentModel } from "@/lib/agent/tools/getSubagentModel";
import { sumLanguageModelUsage } from "@/lib/agent/messageMetadata/sumLanguageModelUsage";

const SUBAGENT_STEP_LIMIT = 30;

const taskInputSchema = z.object({
  task: z.string().describe("Short description of the task (displayed to user)"),
  instructions: z
    .string()
    .describe(
      [
        "Detailed instructions for the subagent. Include:",
        "- Goal and deliverables",
        "- Step-by-step procedure",
        "- Constraints and patterns to follow",
        "- How to verify the work",
      ].join("\n"),
    ),
});

const taskPendingToolCallSchema = z.object({
  name: z.string(),
  input: z.unknown(),
});

export type TaskPendingToolCall = z.infer<typeof taskPendingToolCallSchema>;

/**
 * Output schema mirrors open-agents' `taskOutputSchema`
 * (`packages/agent/tools/task.ts`) so the chat UI can render the same
 * live progress card and expandable subagent transcript when cut over
 * to api's `/api/chat/workflow`. The `execute` is an async generator
 * that yields multiple chunks during the subagent run; the AI SDK
 * pipes each yield through `tool-output-available`.
 */
const taskOutputSchema = z.object({
  pending: taskPendingToolCallSchema.optional(),
  toolCallCount: z.number().int().nonnegative().optional(),
  startedAt: z.number().int().nonnegative().optional(),
  modelId: z.string().optional(),
  final: z.custom<ModelMessage[]>().optional(),
  usage: z.custom<LanguageModelUsage>().optional(),
});

export type TaskToolOutput = z.infer<typeof taskOutputSchema>;

const SUBAGENT_SYSTEM_PROMPT = `You are a focused subagent invoked by a parent agent. Run autonomously — do not ask the user clarifying questions. Complete the delegated task using the tools you have, then return a concise summary of what you did.

Constraints:
- Up to ${SUBAGENT_STEP_LIMIT} tool steps total
- No follow-up questions to the user
- Stay within the scope described in the task; do not pursue tangents
- End with a brief plain-text summary (no markdown headings, no bulleted action list — just what you accomplished)`;

/**
 * `task` — delegate focused, autonomous work to a subagent. The
 * subagent runs its own `streamText` loop with a curated tool set,
 * isolated from the parent's conversation history, and returns a
 * concise summary that the parent can incorporate.
 *
 * Slim port of open-agents' multi-type SUBAGENT_REGISTRY → single
 * generic subagent, but the live-progress streaming pattern is a
 * faithful port: the execute is `async function*`, yielding
 * `{pending, toolCallCount, usage, modelId, startedAt}` chunks
 * throughout the subagent run and a final `{final: ModelMessage[], …}`
 * chunk carrying the full subagent transcript for UI rendering.
 */
export const taskTool = tool({
  description: `Launch a subagent to handle complex tasks autonomously.

WHEN TO USE:
- Clearly-scoped work that can be delegated with explicit instructions
- Work where focused execution would clutter the main conversation
- Multi-step exploration / refactoring that you'd otherwise interleave with other turns

WHEN NOT TO USE (do it yourself):
- Simple, single-file or single-change edits
- Tasks where you already have all the context you need
- Ambiguous work that requires back-and-forth clarification

BEHAVIOR:
- The subagent works AUTONOMOUSLY without asking follow-up questions
- It runs up to ${SUBAGENT_STEP_LIMIT} tool steps and then returns
- It returns ONLY a concise summary — internal steps are isolated from the parent

HOW TO USE:
- Provide a short \`task\` string summarizing the goal (for display)
- Provide detailed \`instructions\` including goals, steps, constraints, and verification criteria

IMPORTANT:
- Be explicit and concrete — the subagent cannot ask clarifying questions
- Include critical context (APIs, function names, file paths) in the instructions
- The parent agent does not see the subagent's internal tool calls, only its final summary`,
  inputSchema: taskInputSchema,
  outputSchema: taskOutputSchema,
  execute: async function* ({ task, instructions }, { experimental_context, abortSignal }) {
    const subagentModel = getSubagentModel(experimental_context, "task");
    const subagentModelId =
      typeof subagentModel === "string"
        ? subagentModel
        : (subagentModel as { modelId?: string }).modelId;

    // `prompt` (not `messages: []`) is required — the AI SDK records zero
    // steps and throws NoOutputGeneratedError if the model has only a
    // system prompt with no user turn. Mirrors open-agents' task tool.
    const result = streamText({
      model: subagentModel,
      system: `${SUBAGENT_SYSTEM_PROMPT}\n\n## Your Task\n${task}\n\n## Instructions\n${instructions}`,
      prompt: "Complete this task and provide a summary of what you accomplished.",
      tools: buildSubagentTools(),
      stopWhen: stepCountIs(SUBAGENT_STEP_LIMIT),
      experimental_context,
      abortSignal,
    });

    const startedAt = Date.now();
    let toolCallCount = 0;
    let pending: TaskPendingToolCall | undefined;
    let usage: LanguageModelUsage | undefined;

    // Emit an initial chunk so the UI can render elapsed time from a
    // stable timestamp and show "Subagent · 0 tools · 0 tokens" before
    // the first step finishes.
    yield { toolCallCount, startedAt, modelId: subagentModelId };

    for await (const part of result.fullStream) {
      if (part.type === "tool-call") {
        toolCallCount += 1;
        pending = { name: part.toolName, input: part.input };
        yield { pending, toolCallCount, usage, startedAt, modelId: subagentModelId };
      }

      if (part.type === "finish-step") {
        usage = sumLanguageModelUsage(usage, part.usage);
        // Keep the last observed `pending` so task UIs don't flicker
        // back to an initializing state between subagent steps.
        yield { pending, toolCallCount, usage, startedAt, modelId: subagentModelId };
      }
    }

    const response = await result.response;
    const finalUsage = usage ?? (await result.totalUsage);
    yield {
      final: response.messages,
      toolCallCount,
      usage: finalUsage,
      startedAt,
      modelId: subagentModelId,
    };
  },
  /**
   * Extract the last assistant text from the subagent's transcript
   * for inclusion in the parent agent's context. Mirrors open-agents'
   * `toModelOutput` (`packages/agent/tools/task.ts`). Operates on the
   * FINAL yielded chunk's `output.final`.
   */
  toModelOutput: ({ output }) => {
    const messages = output?.final;
    if (!messages) return { type: "text", value: "Task completed." };

    const lastAssistant = messages.findLast(m => m.role === "assistant");
    const content = lastAssistant?.content;
    if (!content) return { type: "text", value: "Task completed." };

    if (typeof content === "string") return { type: "text", value: content };

    const lastTextPart = content.findLast(p => p.type === "text");
    if (!lastTextPart) return { type: "text", value: "Task completed." };

    return { type: "text", value: lastTextPart.text };
  },
});
