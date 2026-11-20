import { board } from "@vercel/board";
import { getBoardWatchers } from "@/lib/board/getBoardWatchers";

/** Recoup's team board in Vercel's API, with this deployment's watchers. */
export const team = board({ watch: getBoardWatchers() });
