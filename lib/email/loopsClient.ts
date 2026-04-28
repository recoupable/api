import { LoopsClient } from "loops";

/**
 * Singleton Loops client for tracking contacts.
 * `LOOPS_API_KEY` must be set in the environment.
 */
const loopsClient = new LoopsClient(process.env.LOOPS_API_KEY as string);

export { loopsClient };
