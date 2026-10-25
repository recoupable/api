import { FLAMINGO_MODEL_ID, FLAMINGO_GENERATE_URL, LIGHTWEIGHT_MODEL } from "@/lib/const";
import { buildImageInput } from "@/lib/content/image/buildImageInput";
import { HOUSE_VIDEO_MODEL } from "@/lib/content/video/houseVideoModel";
import { TWELVELABS_ANALYSIS_MODEL } from "@/lib/twelvelabs/analyzeVideo";
import { FAL_IMAGE_USD_PER_UNIT } from "@/lib/content/creditCostForImageUnits";
import { FAL_VIDEO_USD_PER_UNIT } from "@/lib/content/creditCostForVideoUnits";
import { estimateVideoUnits } from "@/lib/content/estimateVideoUnits";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { packExecutionSettings } from "./packExecutionSettings";
/** Server-owned identity of existing routes/settings/charges; not a provider license or immutable weights claim. */
export function getPackExecutionConfiguration() {
  return {
    ...packExecutionSettings,
    models: {
      image: buildImageInput({ ...packExecutionSettings.image, prompt: "" }).model,
      image_edit: buildImageInput({
        ...packExecutionSettings.image,
        prompt: "",
        image_urls: ["https://example.invalid/reference"],
      }).model,
      motion: HOUSE_VIDEO_MODEL,
      caption: LIGHTWEIGHT_MODEL,
      still_inspection: LIGHTWEIGHT_MODEL,
      video_inspection: TWELVELABS_ANALYSIS_MODEL,
      analysis: FLAMINGO_MODEL_ID,
      analysis_endpoint: FLAMINGO_GENERATE_URL,
    },
    rates: {
      image_usd_per_unit: FAL_IMAGE_USD_PER_UNIT,
      video_usd_per_unit: FAL_VIDEO_USD_PER_UNIT,
      video_units_per_second: estimateVideoUnits(1, packExecutionSettings.motion.resolution),
      credits_per_usd: usdToCredits(1),
    },
  };
}
