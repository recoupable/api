import { callChatFunctionsWithResult } from "./callChatFunctionsWithResult";
import { extractTextFromResult } from "./extractTextFromResult";

/**
 * Calls the chat functions directly and returns the plain text response.
 * Encapsulates the logic for calling the chat system and can be reused
 * across different evaluations.
 *
 * @param input - The user input string to send to the chat system
 * @returns The plain text response extracted from the chat result
 * @deprecated Use callChatFunctionsWithResult for access to tool calls
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
