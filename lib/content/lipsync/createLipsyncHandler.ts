import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import fal from "@/lib/fal/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { chargeForGeneration } from "@/lib/content/chargeForGeneration";
import { validateCreateLipsyncBody } from "./validateCreateLipsyncBody";
import { buildLipsyncInput } from "./buildLipsyncInput";
import { estimateLipsyncUnits } from "./estimateLipsyncUnits";
import { creditCostForLipsyncUnits } from "./creditCostForLipsyncUnits";
import { HOUSE_LIPSYNC_MODEL } from "./constants";
import { limitLipsyncGeneration } from "./limitLipsyncGeneration";

/** Generate the existing hosted lipsync model with its own validation and accounting. */
export async function createLipsyncHandler(request: NextRequest): Promise<NextResponse> {
  const body = await validateCreateLipsyncBody(request);
  if (body instanceof NextResponse) return body;
  const fallbackUnits = estimateLipsyncUnits(body.duration);
  try {
    const short = await ensureCreditsOrShortCircuit({
      accountId: body.accountId,
      creditsToDeduct: creditCostForLipsyncUnits(fallbackUnits),
    });
    if (short) return short;
    const limited = await limitLipsyncGeneration(body.accountId);
    if (limited) return limited;
    const result = await fal.subscribe(HOUSE_LIPSYNC_MODEL, { input: buildLipsyncInput(body) });
    const data = result.data as { video?: { url?: string } };
    const videoUrl = data.video?.url;
    if (!videoUrl) {
      return NextResponse.json(
        { status: "error", error: "Lipsync generation returned no video" },
        {
          status: 502,
          headers: getCorsHeaders(),
        },
      );
    }
    await chargeForGeneration({
      accountId: body.accountId,
      endpointId: HOUSE_LIPSYNC_MODEL,
      requestId: result.requestId,
      fallbackUnits,
      creditsForUnits: creditCostForLipsyncUnits,
    });
    return NextResponse.json({ videoUrl }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Lipsync generation failed:", error);
    return NextResponse.json(
      { status: "error", error: "Lipsync generation failed" },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
