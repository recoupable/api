import { ingestionOperationHandler } from "@/lib/ingestion/ingestionOperationHandler";

/** Create private ingestion jobs, read artifacts or deliver accepted output. */
export const POST = ingestionOperationHandler;
/** Read authorized job state or one private artifact through query parameters. */
export const GET = ingestionOperationHandler;
export const maxDuration = 60;
