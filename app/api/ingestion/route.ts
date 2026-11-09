import { ingestionOperationHandler } from "@/lib/ingestion/ingestionOperationHandler";

/** Create private ingestion jobs, read artifacts or deliver accepted output. */
export const POST = ingestionOperationHandler;
export const maxDuration = 60;
