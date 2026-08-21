/**
 * Public bucket for generated and user-uploaded media (database migration
 * 20260508151035). Served from the public CDN; access control comes from the
 * parent row holding the storage_key, never from the object itself.
 */
export const PUBLIC_UPLOADS_BUCKET = "public-uploads";
