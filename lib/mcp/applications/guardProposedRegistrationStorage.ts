import { NextResponse, type NextRequest } from "next/server";
import {
  ProposedStorageFailure,
  type ProposedDependencies,
  type ProposedActor,
} from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
import { verifyExistingApplicationMcpActor } from "./verifyExistingApplicationMcpActor";
import type { createProposedRegistrationMcpLifetime } from "./createProposedRegistrationMcpLifetime";
type Observation = Exclude<
  Awaited<ReturnType<typeof verifyExistingApplicationMcpActor>>,
  NextResponse
>;
export type ProposedMcpInvocation = {
  request: NextRequest;
  admission: Observation;
  dependencies: ProposedDependencies;
  life: ReturnType<typeof createProposedRegistrationMcpLifetime>;
};
/** Compare actual observations, then gate the actual domain call without substituting identity. */
export async function guardProposedRegistrationStorage(
  context: ProposedMcpInvocation,
  operation: "create" | "read",
  signal: AbortSignal,
): Promise<ProposedDependencies> {
  const { request, admission, dependencies, life } = context;
  const deny = (): never => {
    throw new ProposedStorageFailure("denied");
  };
  if (life.terminated() || signal.aborted) deny();
  const fresh = await life.run(() => verifyExistingApplicationMcpActor(request));
  if (fresh instanceof NextResponse) deny();
  const observed = fresh as Observation;
  const a = admission.verificationEvidence.principal;
  const b = observed.verificationEvidence.principal;
  if (
    admission.actor !== observed.actor ||
    admission.workspace !== observed.workspace ||
    admission.verificationEvidence.effectiveAccountId !==
      observed.verificationEvidence.effectiveAccountId ||
    a.actorAccountId !== b.actorAccountId ||
    a.mechanism !== b.mechanism
  )
    deny();
  if (a.mechanism === "recoup_api_key" && (b.mechanism !== "recoup_api_key" || a.keyId !== b.keyId))
    deny();
  if (
    a.mechanism === "privy" &&
    (b.mechanism !== "privy" ||
      a.appId !== b.appId ||
      a.issuer !== b.issuer ||
      a.subject !== b.subject)
  )
    deny();
  // Primitive snapshots cannot be retargeted while the domain authenticates again.
  const expected = Object.freeze({
    actor: admission.actor,
    workspace: admission.workspace,
    freshActor: observed.actor,
    freshWorkspace: observed.workspace,
  });
  const check = (method: "create" | "read", call: ProposedActor) => {
    if (
      method !== operation ||
      life.terminated() ||
      request.signal.aborted ||
      signal.aborted ||
      call.actor !== expected.actor ||
      call.actor !== expected.freshActor ||
      call.workspace !== expected.workspace ||
      call.workspace !== expected.freshWorkspace
    )
      deny();
  };
  const create = dependencies.storage.create.bind(dependencies.storage);
  const read = dependencies.storage.read.bind(dependencies.storage);
  return {
    policy: dependencies.policy,
    storage: {
      create(call) {
        check("create", call);
        return create(call);
      },
      read(call) {
        check("read", call);
        return read(call);
      },
    },
  };
}
