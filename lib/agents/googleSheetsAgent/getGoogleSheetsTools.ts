import { ToolSet } from "ai";
import { CreateConnectedAccountOptions } from "@composio/core";
import { getComposioClient } from "@/lib/composio/client";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import getLatestUserMessageText from "@/lib/messages/getLatestUserMessageText";
import getConnectedAccount, {
  GOOGLE_SHEETS_TOOLKIT_SLUG,
} from "@/lib/composio/googleSheets/getConnectedAccount";
import googleSheetsLoginTool from "@/lib/composio/tools/googleSheetsLoginTool";

/** Frontend callback URL for Google Sheets authentication */
const CHAT_CALLBACK_URL = process.env.CHAT_CALLBACK_URL || "https://chat.recoupable.com";

/**
 * Gets Google Sheets tools for a chat request.
 * If the user is authenticated with Google Sheets, returns the full toolkit.
 * Otherwise, returns a login tool to initiate authentication.
 *
 * @param body - The chat request body
 * @returns ToolSet containing Google Sheets tools
 */
export default async function getGoogleSheetsTools(body: ChatRequestBody): Promise<ToolSet> {
  const { accountId, messages } = body;

  const latestUserMessageText = getLatestUserMessageText(messages);

  const options: CreateConnectedAccountOptions = {
    callbackUrl: `${CHAT_CALLBACK_URL}?q=${encodeURIComponent(latestUserMessageText)}`,
  };

  const composio = getComposioClient();
  const userAccounts = await getConnectedAccount(accountId, options);
  const isAuthenticated = userAccounts.items[0]?.data?.status === "ACTIVE";

  const tools = isAuthenticated
    ? await composio.tools.get(accountId, {
        toolkits: [GOOGLE_SHEETS_TOOLKIT_SLUG],
      })
    : {
        google_sheets_login: googleSheetsLoginTool,
      };

  return tools;
}
