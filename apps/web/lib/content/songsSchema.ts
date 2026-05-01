import { z } from "zod";

/** Shared schema for the optional songs filter — used by both the API and the content prompt agent. */
export const songsSchema = z.array(z.string().min(1)).optional();
