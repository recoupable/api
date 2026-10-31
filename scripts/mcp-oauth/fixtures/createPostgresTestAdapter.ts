import { errors } from "oidc-provider";
import { createOAuthAdapter } from "../../../lib/oauth/createOAuthAdapter";
import { createOAuthCipher } from "../../../lib/oauth/createOAuthCipher";
import { createPostgresTestStore } from "./createPostgresTestStore";

/** Real storage adapter backed only by the isolated testPostgres.sh cluster. */
export function createPostgresTestAdapter(namespace: string) {
  return createOAuthAdapter({
    namespace,
    store: createPostgresTestStore(),
    // Fixed synthetic test keys are never loaded by any production entry point.
    indexKey: Buffer.alloc(32, 1),
    cipher: createOAuthCipher({ activeKeyId: "fixture", keys: { fixture: Buffer.alloc(32, 2) } }),
    invalidGrant: () => new errors.InvalidGrant(),
  });
}
