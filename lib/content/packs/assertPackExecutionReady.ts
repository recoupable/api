/** Fail before funds or provider calls when required production capabilities are unavailable. */
export function assertPackExecutionReady() {
  if (process.env.RELEASE_PACKS_ENABLED !== "true")
    throw new Error("Release pack production is not enabled yet; your brief is saved");
  for (const key of ["FAL_KEY", "TWELVELABS_API_KEY", "SUPABASE_URL", "SUPABASE_KEY"])
    if (!process.env[key])
      throw new Error("Release pack production is temporarily unavailable; your brief is saved");
  if (!process.env.VERCEL_OIDC_TOKEN && !process.env.VERCEL_TOKEN)
    throw new Error("Media composition is unavailable; your brief is saved");
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN)
    throw new Error("Caption and image review are unavailable; your brief is saved");
}
