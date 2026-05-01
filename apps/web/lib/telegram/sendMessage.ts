import TelegramBot from "node-telegram-bot-api";
import telegramClient from "./client";
import { trimMessage } from "./trimMessage";

/**
 * Sends a message to the configured Telegram chat
 *
 * @param text - The message text to send
 * @param options - Optional Telegram message options
 * @returns The sent Telegram message
 */
export const sendMessage = async (
  text: string,
  options?: TelegramBot.SendMessageOptions,
): Promise<TelegramBot.Message> => {
  if (!process.env.TELEGRAM_CHAT_ID) {
    throw new Error("TELEGRAM_CHAT_ID environment variable is required");
  }

  const trimmedText = trimMessage(text);

  return telegramClient.sendMessage(process.env.TELEGRAM_CHAT_ID, trimmedText, options);
};
