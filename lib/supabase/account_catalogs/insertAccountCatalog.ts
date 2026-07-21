import supabase from "../serverClient";

/**
 * Links a catalog to an account by upserting an `account_catalogs` row.
 *
 * Idempotent: linking an account already linked to the catalog is a no-op
 * (`onConflict` on the `(account, catalog)` unique constraint) rather than a
 * unique-violation, so claim paths can call it unconditionally to guarantee
 * ownership without first checking for an existing link.
 *
 * @param params.account - Account id (owner)
 * @param params.catalog - Catalog id to link
 * @throws Error if the upsert fails
 */
export async function insertAccountCatalog(params: {
  account: string;
  catalog: string;
}): Promise<void> {
  const { error } = await supabase
    .from("account_catalogs")
    .upsert(
      { account: params.account, catalog: params.catalog },
      { onConflict: "account,catalog", ignoreDuplicates: true },
    );

  if (error) {
    throw new Error(`Failed to link account_catalogs: ${error.message}`);
  }
}
