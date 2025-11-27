import { experimental_generateImage as generate, type Experimental_GenerateImageResult } from "ai";
import { openai } from "@ai-sdk/openai";

const generateImage = async (prompt: string): Promise<Experimental_GenerateImageResult | null> => {
  try {
    const response = await generate({
      model: openai.image("gpt-image-1"),
      prompt,
      providerOptions: {
        openai: { quality: "high" },
      },
    });
    return response;
  } catch (error) {
    console.error("Error generating image:", error);
  }
};

export default generateImage;
