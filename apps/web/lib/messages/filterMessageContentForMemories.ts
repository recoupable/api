import { Json } from "@/types/database.types";
import { UIMessage } from "ai";

const filterMessageContentForMemories = (message: UIMessage): Json => {
  return {
    role: message.role,
    parts: message.parts,
    content: message.parts
      .filter(part => part.type === "text")
      .map(part => (part.type === "text" ? part.text : ""))
      .join(""),
  } as Json;
};

export default filterMessageContentForMemories;
