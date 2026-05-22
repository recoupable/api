import { tool } from "ai";
import { z } from "zod";

export const todoStatusSchema = z.enum(["pending", "in_progress", "completed"]);
export type TodoStatus = z.infer<typeof todoStatusSchema>;

export const todoItemSchema = z.object({
  id: z.string().describe("Unique identifier for the todo item"),
  content: z.string().describe("The task description"),
  status: todoStatusSchema.describe(
    "Current status. Only ONE task should be in_progress at a time.",
  ),
});
export type TodoItem = z.infer<typeof todoItemSchema>;

/**
 * `todo_write` — the agent's planning surface. Stateless on the server side
 * (the tool simply echoes the list back to the chat UI so the user sees the
 * current plan). The agent uses this to track multi-step work and signal
 * intent between turns.
 *
 * Slot into `buildAgentTools` as `todo_write: todoWriteTool`.
 */
export const todoWriteTool = tool({
  description: `Create and manage a structured task list for the current session.

WHEN TO USE:
- Complex multi-step tasks requiring 3 or more distinct steps
- When the user provides multiple requirements or a checklist
- After receiving new instructions - immediately capture them as todos
- When starting work on a task - mark that todo as in_progress BEFORE beginning
- After completing a task - mark it as completed immediately

WHEN NOT TO USE:
- A single, straightforward task that can be done in one step
- Trivial tasks requiring fewer than 3 minor steps
- Purely conversational or informational queries

TASK STATES:
- "pending": Task not yet started
- "in_progress": Currently being worked on (ONLY ONE todo should be in this state at a time)
- "completed": Task finished successfully

USAGE:
- This tool REPLACES the entire todo list - always send the full, updated list of todos
- Use it frequently to keep the task list in sync with your actual progress
- Update statuses as you start and finish work, rather than batching updates later

IMPORTANT:
- Only one todo should be in_progress at a time; avoid parallel in_progress tasks
- Mark todos as completed as soon as they are done - do not wait to batch completions
- Use clear, concise todo content so the list remains readable to the user`,
  inputSchema: z.object({
    todos: z
      .array(todoItemSchema)
      .describe("The complete list of todo items. This replaces existing todos."),
  }),
  execute: async ({ todos }) => {
    return {
      success: true,
      message: `Updated task list with ${todos.length} items`,
      todos,
    };
  },
});
