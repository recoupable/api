import supabase from "../serverClient";

/**
 * Links a catalog to an account by inserting an `account_catalogs` row.
 *
 * @param params.account - Account id (owner)
 * @param params.catalog - Catalog id to link
 * @throws Error if the insert fails
 */
export async function insertAccountCatalog(params: {
  account: string;
  catalog: string;
}): Promise<void> {
  const { error } = await supabase
    .from("account_catalogs")
    .insert({ account: params.account, catalog: params.catalog });

  if (error) {
    throw new Error(`Failed to link account_catalogs: ${error.message}`);
  }
}
