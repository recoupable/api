/** oidc-provider requires a finite NumericDate. Year 9999 represents until-revoked
 * grants internally; these records have NULL storage expiry and public expiry. */
export const oauthPersistentExpiry = 253402300799;
