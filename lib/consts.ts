/**
 * Re-export all constants from lib/const.ts for compatibility with
 * code migrated from Recoup-Chat that imports from "@/lib/consts"
 */
export * from "./const";

// Additional constants needed for evals that are specific to Recoup-Chat
export const NEW_API_BASE_URL = "https://recoup-api.vercel.app";
