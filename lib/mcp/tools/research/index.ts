import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResearchArtistTool } from "./registerResearchArtistTool";
import { registerResearchMetricsTool } from "./registerResearchMetricsTool";
import { registerResearchAudienceTool } from "./registerResearchAudienceTool";
import { registerResearchCitiesTool } from "./registerResearchCitiesTool";
import { registerResearchSimilarTool } from "./registerResearchSimilarTool";
import { registerResearchPlaylistsTool } from "./registerResearchPlaylistsTool";
import { registerResearchPeopleTool } from "./registerResearchPeopleTool";
import { registerResearchExtractTool } from "./registerResearchExtractTool";
import { registerResearchEnrichTool } from "./registerResearchEnrichTool";
import { registerResearchUrlsTool } from "./registerResearchUrlsTool";
import { registerResearchInstagramPostsTool } from "./registerResearchInstagramPostsTool";
import { registerResearchAlbumsTool } from "./registerResearchAlbumsTool";
import { registerResearchTracksTool } from "./registerResearchTracksTool";
import { registerResearchCareerTool } from "./registerResearchCareerTool";
import { registerResearchInsightsTool } from "./registerResearchInsightsTool";
import { registerResearchLookupTool } from "./registerResearchLookupTool";
import { registerResearchTrackTool } from "./registerResearchTrackTool";
import { registerResearchPlaylistTool } from "./registerResearchPlaylistTool";
import { registerResearchCuratorTool } from "./registerResearchCuratorTool";
import { registerResearchDiscoverTool } from "./registerResearchDiscoverTool";
import { registerResearchGenresTool } from "./registerResearchGenresTool";
import { registerResearchFestivalsTool } from "./registerResearchFestivalsTool";
import { registerResearchMilestonesTool } from "./registerResearchMilestonesTool";
import { registerResearchVenuesTool } from "./registerResearchVenuesTool";
import { registerResearchRankTool } from "./registerResearchRankTool";
import { registerResearchChartsTool } from "./registerResearchChartsTool";
import { registerResearchRadioTool } from "./registerResearchRadioTool";
import { registerResearchSearchTool } from "./registerResearchSearchTool";
/**
 * Registers all research-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllResearchTools = (server: McpServer): void => {
  registerResearchArtistTool(server);
  registerResearchMetricsTool(server);
  registerResearchAudienceTool(server);
  registerResearchCitiesTool(server);
  registerResearchSimilarTool(server);
  registerResearchPlaylistsTool(server);
  registerResearchPeopleTool(server);
  registerResearchExtractTool(server);
  registerResearchEnrichTool(server);
  registerResearchUrlsTool(server);
  registerResearchInstagramPostsTool(server);
  registerResearchAlbumsTool(server);
  registerResearchTracksTool(server);
  registerResearchCareerTool(server);
  registerResearchInsightsTool(server);
  registerResearchLookupTool(server);
  registerResearchTrackTool(server);
  registerResearchPlaylistTool(server);
  registerResearchCuratorTool(server);
  registerResearchDiscoverTool(server);
  registerResearchGenresTool(server);
  registerResearchFestivalsTool(server);
  registerResearchMilestonesTool(server);
  registerResearchVenuesTool(server);
  registerResearchRankTool(server);
  registerResearchChartsTool(server);
  registerResearchRadioTool(server);
  registerResearchSearchTool(server);
};
