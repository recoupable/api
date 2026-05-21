import { streamText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { buildSubagentTools } from "@/lib/agent/tools/buildSubagentTools";
import { getSubagentModel } from "@/lib/agent/tools/getSubagentModel";

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
 * generic subagent. Streaming progress isn't piped to the UI (the
 * parent sees one long-running tool call until completion); add an
 * async-generator execute later if live progress matters.
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
  execute: async ({ task, instructions }, { experimental_context, abortSignal }) => {
    // Resolves to ctx.subagentModel ?? ctx.model, throwing if context
    // wasn't populated by runAgentStep. Mirrors open-agents' task tool
    // (`getSubagentModel(experimental_context, "task")`).
    const subagentModel = getSubagentModel(experimental_context, "task");

    try {
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

      // Drain fullStream so the subagent actually runs to completion.
      // Streaming progress back to the parent UI is not wired in this slim
      // port — the parent sees one long-running tool call until the
      // subagent finishes.
      for await (const _part of result.fullStream) {
        void _part;
      }

      const response = await result.response;
      const lastAssistant = response.messages.findLast(m => m.role === "assistant");
      const content = lastAssistant?.content;

      let summary = "";
      if (typeof content === "string") {
        summary = content;
      } else if (Array.isArray(content)) {
        const lastText = content.findLast(p => p.type === "text");
        if (lastText && "text" in lastText) summary = lastText.text;
      }

      if (!summary) {
        return {
          success: false,
          summary: "Subagent finished with no assistant text. The task may be incomplete.",
        };
      }

      return { success: true, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Subagent failed: ${message}` };
    }
  },
});
