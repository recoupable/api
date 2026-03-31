import { ToolsCalled } from "./scorers/ToolsCalled";

/**
 * Creates a scorer that checks whether the required tools were called during
 * a chat evaluation, and optionally penalizes calls to disallowed tools.
 *
 * @param requiredTools - List of tool name substrings that must be called for a full score
 * @param penalizedTools - List of tool name substrings whose calls reduce the score
 * @returns An async scorer function compatible with the evaluation framework
 */
export const createToolsCalledScorer = (requiredTools: string[], penalizedTools: string[] = []) => {
  return async (args: { output: unknown; expected?: string; input: string }) => {
    // Extract output text and toolCalls
    const outputText =
      typeof args.output === "object" && args.output && "output" in args.output
        ? (args.output.output as string)
        : (args.output as string);

    const toolCalls =
      typeof args.output === "object" && args.output && "toolCalls" in args.output
        ? (args.output.toolCalls as Array<{
            toolName: string;
            args: Record<string, unknown>;
          }>)
        : undefined;

    return await ToolsCalled({
      output: outputText,
      input: args.input,
      expected: args.expected,
      toolCalls,
      requiredTools,
      penalizedTools,
    });
  };
};
