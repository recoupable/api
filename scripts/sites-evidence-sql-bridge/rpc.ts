import { state } from "./fixtureState";
import { fixtureSql } from "./fixtureSql";
import { literal } from "./quoteFixtureLiteral";
const keys: Record<string, string[]> = {
  record_evidence: [
    "p_actor",
    "p_owner",
    "p_site",
    "p_revision",
    "p_key",
    "p_candidate",
    "p_candidate_canonical",
    "p_candidate_sha",
    "p_decision",
    "p_review_canonical",
  ],
  read_evidence: ["p_actor", "p_owner", "p_site", "p_record"],
  publish_candidate: [
    "p_actor",
    "p_owner",
    "p_site",
    "p_revision",
    "p_record",
    "p_candidate_sha",
    "p_expected_pointer",
    "p_expected_artist_id",
  ],
};
export async function rpc(name: string, args: Record<string, unknown>) {
  if (
    !keys[name] ||
    JSON.stringify(Object.keys(args).sort()) !== JSON.stringify([...keys[name]].sort())
  )
    throw new Error("Unexpected RPC envelope");
  state.calls.push({ name, args: structuredClone(args) });
  if (name === "publish_candidate") state.beforePublish?.();
  let data: unknown;
  try {
    const output = fixtureSql(
      `SET ROLE service_role; SELECT sites_evidence_proposal.${name}(${keys[name].map(k => `${k} => ${literal(args[k])}`).join(",")});`,
    );
    data = output === "" ? null : JSON.parse(output);
  } catch (error) {
    const code = (error as { sqlstate?: string }).sqlstate;
    if (!code || !(error as { proposalError?: boolean }).proposalError) throw error;
    state.errors.push(code);
    return { data: null, error: { code } };
  }
  if (name === "publish_candidate") {
    if (state.afterPublish === "lost") throw new Error("Synthetic postcommit response loss");
    if (state.afterPublish === "tamper")
      (data as { humanApproval: string }).humanApproval = "approved";
    if (state.afterPublish === "null") data = null;
  }
  return { data, error: null };
}
