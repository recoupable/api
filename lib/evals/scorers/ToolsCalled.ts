/**
 * Generic scorer that checks if specific tools were called during an evaluation run.
 * Scores 0–1 based on the fraction of required tools that appear in the tool call list,
 * with optional penalties for calls to disallowed tools.
 *
 * @param root0 - The scorer arguments object
 * @param root0.output - The AI response text (used for interface compatibility)
 * @param root0.expected - The expected output string (unused, required by scorer interface)
 * @param root0.input - The original user input that triggered the tool calls
 * @param root0.toolCalls - Array of tool call records collected from all generation steps
 * @param root0.requiredTools - Tool name substrings that must be called for a full score
 * @param root0.penalizedTools - Tool name substrings whose calls reduce the score by 0.3 each
 * @returns A scorer result with name, numeric score, and metadata listing called/missing tools
 */
export const ToolsCalled = async ({
  toolCalls,
  requiredTools = [],
  penalizedTools = [],
}: {
  output: string;
  expected?: string;
  input: string;
  toolCalls?: Array<{ toolName: string; args: Record<string, unknown> }>;
  requiredTools?: string[];
  penalizedTools?: string[];
}) => {
  try {
    const calledTools = toolCalls?.map(tc => tc.toolName) || [];

    // Check if required tools were called
    const calledRequiredTools = requiredTools.filter(requiredTool =>
      calledTools.some(tool => tool.toLowerCase().includes(requiredTool.toLowerCase())),
    );

    // Check if penalized tools were called
    const calledPenalizedTools = penalizedTools.filter(penalizedTool =>
      calledTools.some(tool => tool.toLowerCase().includes(penalizedTool.toLowerCase())),
    );

    // Calculate score based on required tools
    let score = 0;

    if (requiredTools.length === 0) {
      // No required tools specified - scorer not properly configured
      return {
        name: "tools_called",
        score: 0,
        metadata: {
          error: "No required tools specified",
          calledTools,
        },
      };
    }

    // Score based on percentage of required tools called
    score = calledRequiredTools.length / requiredTools.length;

    // Penalize for calling penalized tools
    if (calledPenalizedTools.length > 0) {
      score = Math.max(0, score - calledPenalizedTools.length * 0.3);
    }

    score = Math.max(0, Math.min(1, score));

    return {
      name: "tools_called",
      score,
      metadata: {
        calledTools,
        requiredTools,
        calledRequiredTools,
        penalizedTools,
        calledPenalizedTools,
        missingRequiredTools: requiredTools.filter(tool => !calledRequiredTools.includes(tool)),
      },
    };
  } catch (error) {
    console.error("Error in ToolsCalled scorer:", error);
    return {
      name: "tools_called",
      score: 0,
      metadata: {
        error: "Failed to evaluate tool calls",
        error_message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
};
