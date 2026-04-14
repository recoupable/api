import { callChatFunctionsWithResult } from "./callChatFunctionsWithResult";
import { extractTextFromResult } from "./extractTextFromResult";

/**
 * Call Chat Functions.
 *
 * @param input - Parameter.
 * @returns - Result.
 */
export async function callChatFunctions(input: string): Promise<string> {
  try {
    const result = await callChatFunctionsWithResult(input);
    return extractTextFromResult(result);
  } catch (error) {
    console.error("Error calling chat functions:", error);
    throw error;
  }
}
