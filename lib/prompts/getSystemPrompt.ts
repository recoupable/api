import { SYSTEM_PROMPT } from "@/lib/chat/const";
import { AccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";

/**
 * Generates a system prompt for the chat
 *
 * @param params - The parameters for the system prompt
 * @param params.roomId - The ID of the room
 * @param params.artistId - The ID of the artist
 * @param params.accountId - The ID of the account
 * @param params.email - The email of the account
 * @param params.knowledgeBaseText - The knowledge base text
 * @param params.artistInstruction - The artist instruction
 * @param params.conversationName - The name of the conversation
 * @param params.accountWithDetails - The account with details
 * @returns The system prompt
 */
export function getSystemPrompt({
  roomId,
  artistId,
  accountId,
  orgId,
  email,
  knowledgeBaseText,
  artistInstruction,
  conversationName = "New conversation",
  accountWithDetails,
}: {
  roomId?: string;
  artistId?: string;
  accountId: string;
  orgId?: string | null;
  email?: string;
  knowledgeBaseText?: string;
  artistInstruction?: string;
  conversationName?: string;
  accountWithDetails?: AccountWithDetails;
}): string {
  let systemPrompt = `${SYSTEM_PROMPT}

  **IMPORTANT CONTEXT VALUES (use these exact values in tools):**
  - account_id: ${accountId || "Unknown"} (use this for ALL tools that require account_id parameter)
  - organization_id: ${orgId || "None. Personal Account."}
  - artist_account_id: ${artistId}
  - active_account_email: ${email || "Unknown"}
  - active_conversation_id: ${roomId || "No ID"}
  - active_conversation_name: ${conversationName || "No Chat Name"}

  **IMAGE EDITING INSTRUCTIONS:**
  When the user asks to edit an image (e.g., "add glasses", "make it darker", "add a hat"):
  
  **WHICH IMAGE TO EDIT:**
  1. Check conversation history for the most recent edit_image tool result
  2. If found: Use the imageUrl from that result (e.g., "https://v3b.fal.media/files/...")
  3. If NOT found OR user says "original": Use the URL from "ATTACHED IMAGE URLS" section below
  4. This ensures edits build on each other (glasses → then hat keeps the glasses)
  
  **HOW TO CALL THE TOOL:**
  - IMMEDIATELY call edit_image (don't explain first)
  - imageUrl: The URL determined from steps above (NEVER use "attachment://")
  - prompt: Describe the edit clearly (e.g., "add sunglasses to the person")
  - account_id: Use the account_id value shown above
  - DO NOT ask the user for any information - you have everything you need`;

  if (accountWithDetails) {
    let userSection = `

-----CURRENT USER CONTEXT-----
This is information about the person currently using this application (the human you're talking to):

Name: ${accountWithDetails.name || "Not provided"}
Email: ${accountWithDetails.email || email || "Not provided"}`;

    if (
      accountWithDetails.job_title ||
      accountWithDetails.role_type ||
      accountWithDetails.company_name ||
      accountWithDetails.organization
    ) {
      userSection += `

Professional Context:`;
      if (accountWithDetails.job_title)
        userSection += `
- Job Title: ${accountWithDetails.job_title}`;
      if (accountWithDetails.role_type)
        userSection += `
- Role Type: ${accountWithDetails.role_type}`;
      if (accountWithDetails.company_name)
        userSection += `
- Company: ${accountWithDetails.company_name}`;
      if (accountWithDetails.organization)
        userSection += `
- Organization: ${accountWithDetails.organization}`;
    }

    if (accountWithDetails.instruction) {
      userSection += `

User's Custom Instructions & Preferences:
${accountWithDetails.instruction}`;
    }

    userSection += `
-----END USER CONTEXT-----`;

    systemPrompt = `${systemPrompt}${userSection}`;
  }

  if (artistInstruction) {
    systemPrompt = `${systemPrompt}

-----SELECTED ARTIST/WORKSPACE CONTEXT-----
This is information about the artist/workspace the user is currently working with:

Custom Instructions for this Artist:
${artistInstruction}
-----END ARTIST/WORKSPACE CONTEXT-----`;
  }

  if (knowledgeBaseText) {
    systemPrompt = `${systemPrompt}

-----ARTIST/WORKSPACE KNOWLEDGE BASE-----
Additional context and knowledge for the selected artist/workspace:
${knowledgeBaseText}
-----END ARTIST/WORKSPACE KNOWLEDGE BASE-----`;
  }

  return systemPrompt;
}

export default getSystemPrompt;
