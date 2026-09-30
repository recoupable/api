import { afterEach, expect, it, vi } from "vitest";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchContextReleaseTrackIsrcs } from "../dispatchContextReleaseTrackIsrcs";

const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const subjectId = "44444444-4444-4444-8444-444444444444";
vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: vi.fn(async () => ({ accountId: actor, error: null })),
}));
vi.mock("../authorizeContextOwner", () => ({
  authorizeContextOwner: vi.fn(async () => ({ ownerId: owner })),
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: vi.fn() }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(),
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it.each([true, false])(
  "MCP release-track dispatch honors enabled=%s through the shared operation",
  async enabled => {
    vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED", String(enabled));
    vi.mocked(callContextRpc).mockResolvedValue({ state: "ready", linkedSlots: 2, hasMore: false });
    const registerTool = vi.fn();
    registerContextTool({ registerTool } as never);
    const invoke = registerTool.mock.calls[0][2];
    const response = await invoke(
      {
        action: "verify_release_tracks",
        organization_id: owner,
        request_id: requestId,
        subject_id: subjectId,
      },
      {},
    );
    if (enabled) {
      expect(dispatchContextReleaseTrackIsrcs).toHaveBeenCalledExactlyOnceWith(
        actor,
        owner,
        requestId,
        subjectId,
      );
      expect(JSON.stringify(response)).toContain("lookupQueued");
    } else {
      expect(dispatchContextReleaseTrackIsrcs).not.toHaveBeenCalled();
      expect(callContextRpc).not.toHaveBeenCalled();
      expect(JSON.parse(response.content[0].text)).toMatchObject({ success: false });
    }
  },
);
