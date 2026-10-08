import { getArtists } from "@/lib/artists/getArtists";
import { prepareFullOAuthTool } from "./prepareFullOAuthTool";
import { executeFullOAuthTool } from "./executeFullOAuthTool";
import type { FullOAuthToolServices } from "./registerFullOAuthTools";
/** Shared domain operations plus delegated ownership guards. */
export function createFullOAuthToolServices(): FullOAuthToolServices {
  return {
    prepare: prepareFullOAuthTool,
    execute: executeFullOAuthTool,
    listArtists: accountId => getArtists({ accountId }),
  };
}
