import { generateObject } from "ai";
import { DEFAULT_MODEL } from "@/lib/const";
import { z } from "zod";

export interface GenerateArrayResult {
  segmentName: string;
  fans: string[];
}

const generateArray = async ({
  system,
  prompt,
}: {
  system?: string;
  prompt: string;
}): Promise<GenerateArrayResult[]> => {
  const result = await generateObject({
    model: DEFAULT_MODEL,
    system,
    prompt,
    output: "array",
    schema: z.object({
      segmentName: z.string().describe("Segment name."),
      fans: z
        .array(z.string())
        .describe(
          "For each Segment Name return an array of fan_social_id included in the segment. Do not make these up. Only use the actual fan_social_id provided in the fan data prompt input.",
        ),
    }),
  });

  return result.object;
};

export default generateArray;
