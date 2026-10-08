import { z } from "zod";
import {
  confirmProfessionalSchema,
  listProfessionalsSchema,
  professionalListSchema,
  professionalResultSchema,
} from "./schema";
import { executeProfessionalRoster } from "@/lib/supabase/organization_professionals/executeProfessionalRoster";
import { ProfessionalRosterError } from "./ProfessionalRosterError";

/** Shared REST/MCP contract: research is never roster intent and names never select identity. */
export async function processProfessionalRoster(
  actor: string,
  action: "list" | "confirm",
  raw: unknown,
) {
  z.uuid().parse(actor);
  const input =
    action === "list" ? listProfessionalsSchema.parse(raw) : confirmProfessionalSchema.parse(raw);
  const data = await executeProfessionalRoster(actor, input);
  const result =
    action === "list"
      ? professionalListSchema.safeParse(data)
      : professionalResultSchema.safeParse(data);
  if (!result.success)
    throw new ProfessionalRosterError(
      "Invalid roster response. Retry with the same request key.",
      503,
    );
  const people =
    "professional" in result.data ? [result.data.professional] : result.data.professionals;
  if (people.some(person => person.organization_id !== input.organization_id))
    throw new ProfessionalRosterError("Invalid roster scope", 503);
  return result.data;
}
