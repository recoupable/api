import { applicationRegistrationSchema } from "../applicationRegistrationSchema";
import { validateApplicationRegistration } from "../validateApplicationRegistration";
import type { ProposedProjection } from "./proposedRegistrationContract";
/** Reuse canonical validation, then project exact SQL COLLATE C ordering without URL normalization. */
export async function projectProposedRegistration(
  actor: string,
  input: unknown,
): Promise<ProposedProjection> {
  const body = applicationRegistrationSchema.omit({ organization_id: true }).strict().parse(input);
  const validated = await validateApplicationRegistration(actor, body);
  if (validated.workspace_id !== actor || validated.billing_owner_id !== actor)
    throw new Error("Canonical workspace binding unavailable");
  const sort = (values: string[]) =>
    [...values].sort((a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")));
  const registration = {
    name: validated.name,
    origins: sort(validated.allowed_origins).map(origin => ({
      origin,
      hostname: new URL(origin).hostname,
      return_urls: sort(validated.return_urls.filter(url => new URL(url).origin === origin)),
    })),
  };
  if (Buffer.byteLength(JSON.stringify(registration), "utf8") > 262144)
    throw new Error("Registration exceeds proposal bound");
  return { environment: validated.environment, registration };
}
