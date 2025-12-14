import { createYouTubeAPIClient } from "@/lib/youtube/oauth-client";

// YouTube Channel Data Types
export interface YouTubeChannelData {
  id: string;
  title: string;
  description: string;
  uploadsPlaylistId?: string;
  thumbnails: {
    default: {
      url: string | null;
    };
    medium: {
      url: string | null;
    };
    high: {
      url: string | null;
    };
  };
  statistics: {
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
    hiddenSubscriberCount: boolean;
  };
  customUrl: string | null;
  country: string | null;
  publishedAt: string;
  branding?: {
    keywords: string | null;
    defaultLanguage: string | null;
  };
}

// Error messages
const YouTubeErrorMessages = {
  NO_CHANNELS: "No YouTube channels found for this authenticated account",
  API_ERROR: "Failed to fetch YouTube channel information",
  AUTH_FAILED: "YouTube authentication failed. Please sign in again.",
};

/**
 * Fetches YouTube channel information using authenticated tokens
 *
 * @param params - { accessToken, refreshToken, includeBranding }
 * @param params.accessToken - YouTube access token
 * @param params.refreshToken - YouTube refresh token (optional)
 * @param params.includeBranding - Whether to include branding information (default: false)
 * @returns Promise with array of channel data or error details
 */
export async function fetchYouTubeChannelInfo({
  accessToken,
  refreshToken,
  includeBranding = false,
}: {
  accessToken: string;
  refreshToken?: string;
  includeBranding?: boolean;
}): Promise<
  | { success: true; channelData: YouTubeChannelData[] }
  | { success: false; error: { code: string; message: string } }
> {
  try {
    // Create YouTube API client with tokens
    const youtube = createYouTubeAPIClient(accessToken, refreshToken);

    // Determine which parts to fetch based on requirements
    const parts = ["snippet", "statistics"];
    if (includeBranding) {
      parts.push("brandingSettings", "status");
    }

    // Fetch channel information
    const response = await youtube.channels.list({
      part: parts,
      mine: true,
    });

    if (!response.data.items || response.data.items.length === 0) {
      return {
        success: false,
        error: {
          code: "NO_CHANNELS",
          message: YouTubeErrorMessages.NO_CHANNELS,
        },
      };
    }

    // Map all channels
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channelData = response.data.items.map((channelData: any) => ({
      id: channelData.id || "",
      title: channelData.snippet?.title || "",
      description: channelData.snippet?.description || "",
      uploadsPlaylistId: channelData.contentDetails?.relatedPlaylists?.uploads,
      thumbnails: {
        default: {
          url: channelData.snippet?.thumbnails?.default?.url || null,
        },
        medium: {
          url: channelData.snippet?.thumbnails?.medium?.url || null,
        },
        high: {
          url: channelData.snippet?.thumbnails?.high?.url || null,
        },
      },
      statistics: {
        subscriberCount: channelData.statistics?.subscriberCount || "0",
        videoCount: channelData.statistics?.videoCount || "0",
        viewCount: channelData.statistics?.viewCount || "0",
        hiddenSubscriberCount: channelData.statistics?.hiddenSubscriberCount === true,
      },
      customUrl: channelData.snippet?.customUrl || null,
      country: channelData.snippet?.country || null,
      publishedAt: channelData.snippet?.publishedAt || "",
      ...(includeBranding && {
        branding: {
          keywords: channelData.brandingSettings?.channel?.keywords || null,
          defaultLanguage: channelData.brandingSettings?.channel?.defaultLanguage || null,
        },
      }),
    }));

    return {
      success: true,
      channelData,
    };
  } catch (error: unknown) {
    console.error("Error fetching YouTube channel info:", error);

    // If token is invalid/expired, return appropriate error
    if (error && typeof error === "object" && "code" in error && error.code === 401) {
      return {
        success: false,
        error: {
          code: "API_ERROR",
          message: YouTubeErrorMessages.AUTH_FAILED,
        },
      };
    }

    return {
      success: false,
      error: {
        code: "API_ERROR",
        message: error instanceof Error ? error.message : YouTubeErrorMessages.API_ERROR,
      },
    };
  }
}

