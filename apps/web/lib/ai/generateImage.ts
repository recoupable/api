import { GeneratedFile, LanguageModelUsage, ModelMessage, TextPart, type FilePart } from "ai";
import { createImageGenerationAgent } from "@/lib/agents/ImageGenerationAgent";

const generateImage = async (
  prompt: string,
  files?: FilePart[],
): Promise<{ image: GeneratedFile; usage: LanguageModelUsage } | null> => {
  try {
    const agent = createImageGenerationAgent();

    // Build content array with prompt first, then optionally append files
    const content: Array<TextPart | FilePart> = [{ type: "text", text: prompt }];

    if (files && files.length > 0) {
      content.push(...files);
    }

    const messages: ModelMessage[] = [
      {
        role: "user",
        content,
      } as ModelMessage,
    ];

    const response = await agent.generate({
      messages,
    });

    return { image: response.files[0], usage: response.usage };
  } catch (error) {
    console.error("Error generating image:", error);
  }
};

export default generateImage;
