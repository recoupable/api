import supabase from "../serverClient";

/**
 * Delete a slack installation by organization_id.
 *
 * @param organizationId - The organization UUID to delete the installation for
 */
export async function deleteSlackInstallation(organizationId: string): Promise<void> {
  const { error } = await supabase
    .from("slack_installations")
    .delete()
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(`Failed to delete slack installation: ${error.message}`);
  }
}
