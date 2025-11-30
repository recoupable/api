import { GeneratedFile, generateText, LanguageModelUsage } from "ai";

const generateImage = async (
  prompt: string,
): Promise<{ image: GeneratedFile; usage: LanguageModelUsage } | null> => {
  try {
    const response = await generateText({
      model: "google/gemini-3-pro-image",
      prompt,
    });

    return { image: response.files[0], usage: response.usage };
  } catch (error) {
    console.error("Error generating image:", error);
  }
};

export default generateImage;
