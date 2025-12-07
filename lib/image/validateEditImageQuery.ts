import { z } from "zod";
import { generateImageQuerySchema } from "./validateGenerateImageQuery";

export const editImageQuerySchema = generateImageQuerySchema.extend({
  imageUrl: z.url("Must be a valid image URL").describe("URL of the image to edit"),
});

export type EditImageQuery = z.infer<typeof editImageQuerySchema>;
