import { entitlementResultSchema, type EntitlementResult } from "./entitlementResultSchema";
import { entitlementInputSchema } from "./entitlementSchemas";

type Row = Record<string, unknown>;
// Finite base-10 arithmetic. The canonical method's bounded products/sums stay
// below Decimal(precision=128); BigInt avoids binary floats and rounding entirely.
class Decimal {
  constructor(
    readonly coefficient: bigint,
    readonly scale = 0,
    readonly negativeZero = false,
  ) {}
  add(other: Decimal): Decimal {
    const scale = Math.max(this.scale, other.scale);
    return new Decimal(
      this.coefficient * 10n ** BigInt(scale - this.scale) +
        other.coefficient * 10n ** BigInt(scale - other.scale),
      scale,
      this.negativeZero && other.negativeZero,
    );
  }
  neg() {
    return new Decimal(-this.coefficient, this.scale);
  }
  sub(other: Decimal) {
    return this.add(other.neg());
  }
  mul(other: Decimal) {
    return new Decimal(
      this.coefficient * other.coefficient,
      this.scale + other.scale,
      (this.coefficient < 0n || this.negativeZero) !==
        (other.coefficient < 0n || other.negativeZero),
    );
  }
  compare(other: Decimal) {
    const n = this.sub(other).coefficient;
    return n < 0n ? -1 : n > 0n ? 1 : 0;
  }
  toJSON() {
    const digits = (this.coefficient < 0n ? -this.coefficient : this.coefficient)
      .toString()
      .padStart(this.scale + 1, "0");
    return (
      (this.coefficient < 0n || (this.coefficient === 0n && this.negativeZero) ? "-" : "") +
      (this.scale > 0
        ? digits.slice(0, -this.scale) + "." + digits.slice(-this.scale)
        : digits + (this.coefficient !== 0n ? "0".repeat(-this.scale) : ""))
    );
  }
}
const zero = new Decimal(0n),
  one = new Decimal(1n);
function amount(value: unknown, label = "amount"): Decimal {
  if (typeof value !== "string" && !(typeof value === "number" && Number.isSafeInteger(value)))
    throw new Error(`${label} must be an exact decimal string or integer`);
  const normalized = String(value)
    .trim()
    .replace(/^([+-]?)\./, "$10.");
  const match = normalized.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match) throw new Error(`${label} is not a decimal`);
  const exponent = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  const digits = (match[2] + (match[3] ?? "")).replace(/^0+(?=\d)/, "");
  if (
    !Number.isSafeInteger(exponent) ||
    digits.length + Math.max(exponent, 0) > 24 ||
    Math.max(-exponent, 0) > 18
  )
    throw new Error(
      `${label} exceeds supported range: at most 24 coefficient/integer digits and 18 fractional places`,
    );
  return new Decimal(
    BigInt((match[1] === "-" ? "-" : "") + digits),
    -exponent,
    match[1] === "-" && BigInt(digits) === 0n,
  );
}
function unique(items: unknown, key: string): Map<string, Row> {
  if (!Array.isArray(items) || items.length > 10000)
    throw new Error(`${key} collection must be a list of at most 10000 records`);
  const result = new Map<string, Row>();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error(`${key} records must be objects`);
    const id = item[key];
    if (typeof id !== "string") throw new Error(`${key} must be a string`);
    if (!id || result.has(id)) throw new Error(`Missing or duplicate ${key}: ${id}`);
    result.set(id, item);
  }
  return result;
}
function refs(row: Row, label: string): string[] {
  const values = row.evidence_refs;
  if (
    !Array.isArray(values) ||
    !values.length ||
    !values.every(v => typeof v === "string" && v.trim())
  )
    throw new Error(`${label} requires evidence_refs`);
  return values;
}
function currency(row: Row): string {
  if (typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency))
    throw new Error("currency must be an explicit uppercase three-letter code");
  return row.currency;
}
function date(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000") ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error(`${label} requires an ISO date`);
  return value;
}
function truthy(value: unknown): boolean {
  return Array.isArray(value)
    ? value.length > 0
    : value !== null && typeof value === "object"
      ? Object.keys(value).length > 0
      : Boolean(value);
}
function pythonText(value: unknown): string {
  return Array.isArray(value)
    ? `[${value.map(v => (typeof v === "string" ? `'${v}'` : pythonText(v))).join(", ")}]`
    : value === undefined || value === null
      ? "None"
      : String(value);
}
const kinds = new Set([
  "deduction",
  "reserve_withheld",
  "reserve_released",
  "withholding",
  "reversal",
  "recognized_adjustment",
]);

/** Pure port of the pinned canonical entitlement method; no authority or persistence. */
export function calculateEntitlements(input: unknown): EntitlementResult {
  const data = entitlementInputSchema.parse(input);
  const rules = unique(data.rules ?? [], "rule_id"),
    lines = unique(data.lines ?? [], "line_id");
  const results: Array<
    Row & { line_id: string; expected_amount: Decimal; currency: string; evidence_refs: string[] }
  > = [];
  const errors: Row[] = [],
    recoupment: Row[] = [],
    allocated = new Set<string>();
  for (const [line_id, line] of lines) {
    try {
      const rule = rules.get(line.rule_id as string);
      if (!rule) throw new Error("No explicit rule_id with evidenced terms");
      let evidence = [...refs(line, line_id), ...refs(rule, rule.rule_id as string)];
      if (!truthy(rule.rule_version)) throw new Error("rule_version is required");
      if (truthy(rule.unsupported_terms))
        throw new Error(
          "Manual workpaper required for unsupported terms: " + pythonText(rule.unsupported_terms),
        );
      if (rule.adjustments_complete !== true)
        throw new Error(
          "Confirm the adjustment schedule is complete; missing schedules are not zero",
        );
      const ccy = currency(line),
        start = date(line.period_start, "period_start"),
        end = date(line.period_end, "period_end");
      if (
        start > end ||
        start < date(rule.effective_start, "effective_start") ||
        end > date(rule.effective_end, "effective_end")
      )
        throw new Error(
          "Line falls outside or spans rule effective period; split with source evidence",
        );
      if (line.rights_type !== rule.rights_type || !truthy(rule.rights_type))
        throw new Error(
          "Rights basis mismatch; publishing income does not establish master participation",
        );
      if (
        !truthy(line.territory) ||
        !Array.isArray(rule.territories) ||
        !rule.territories.includes(line.territory)
      )
        throw new Error("Territory is outside explicit rule scope");
      const basis = rule.basis;
      if (basis !== "gross_amount" && basis !== "owner_net_amount")
        throw new Error(
          "Rule needs an explicit gross_amount or owner_net_amount contractual basis",
        );
      const base = amount(line[basis], basis),
        rate = amount(rule.participation_rate, "participation_rate"),
        commission = amount(rule.commission_rate, "commission_rate");
      if (
        rate.compare(zero) < 0 ||
        rate.compare(one) > 0 ||
        commission.compare(zero) < 0 ||
        commission.compare(one) > 0
      )
        throw new Error("Rates must be fractions in [0,1] with their contractual basis");
      if (rule.commission_basis !== "participation")
        throw new Error("Unsupported commission basis; use an evidenced manual workpaper");
      const already = rule.already_net_of;
      if (!Array.isArray(already))
        throw new Error("already_net_of must explicitly list included deductions (or [])");
      if (commission.compare(zero) !== 0 && already.includes("commission"))
        throw new Error("Would double-deduct commission already in the basis");
      const participating = base.mul(rate),
        fee = participating.mul(commission);
      let expected = participating.sub(fee);
      const bridge: Row[] = [
        { operation: "basis", amount: base },
        { operation: "participation", rate, amount: participating },
        { operation: "commission", rate: commission, amount: fee.neg() },
      ];
      for (const adjustment of unique(
        line.adjustments === undefined ? [] : line.adjustments,
        "adjustment_id",
      ).values()) {
        const kind = adjustment.kind;
        if (!kinds.has(kind as string) || already.includes(kind))
          throw new Error("Unknown or already deducted adjustment: " + pythonText(kind));
        if ("currency" in adjustment && currency(adjustment) !== ccy)
          throw new Error(
            "Adjustment currency differs from line; use an evidenced manual FX workpaper",
          );
        evidence = evidence.concat(refs(adjustment, "adjustment"));
        const delta = amount(adjustment.amount, "adjustment.amount");
        if (
          ["deduction", "reserve_withheld", "withholding"].includes(kind as string) &&
          delta.compare(zero) > 0
        )
          throw new Error(`${kind} must be nonpositive`);
        if (kind === "reserve_released" && delta.compare(zero) < 0)
          throw new Error("reserve_released must be nonnegative");
        expected = expected.add(delta);
        bridge.push({ operation: kind, amount: delta });
      }
      const reported = amount(line.reported_amount, "reported_amount"),
        variance = expected.sub(reported);
      results.push({
        line_id,
        rule_id: rule.rule_id,
        rule_version: rule.rule_version,
        status: "calculated",
        currency: ccy,
        period_start: start,
        period_end: end,
        expected_amount: expected,
        reported_amount: reported,
        variance,
        variance_direction:
          variance.compare(zero) > 0
            ? "potential_underpayment"
            : variance.compare(zero) < 0
              ? "potential_overpayment_or_clawback"
              : "matched",
        recovered_cash: null,
        evidence_refs: [...new Set(evidence)].sort(),
        bridge,
      });
    } catch (error) {
      errors.push({
        line_id,
        reason: (error as Error).message,
        status: "manual_workpaper_required",
      });
    }
  }
  const byId = new Map(results.map(row => [row.line_id, row]));
  for (const account of unique(data.recoupment_accounts ?? [], "account_id").values()) {
    try {
      const identity = account.account_id as string;
      let evidence = refs(account, identity);
      const ccy = currency(account);
      if (account.cross_collateralization !== false)
        throw new Error("Cross-collateralization requires a separate reviewed manual workpaper");
      const opening = amount(account.opening_balance, "opening_balance");
      if (opening.compare(zero) < 0)
        throw new Error("Opening recoupment balance cannot be negative");
      let movements = zero,
        earnings = zero;
      for (const move of unique(
        account.movements === undefined ? [] : account.movements,
        "movement_id",
      ).values()) {
        if (!["advance", "cost", "supported_adjustment"].includes(move.kind as string))
          throw new Error("Unsupported recoupment movement");
        if ("currency" in move && currency(move) !== ccy)
          throw new Error(
            "Movement currency differs from recoupment account; use an evidenced manual FX workpaper",
          );
        evidence = evidence.concat(refs(move, "movement"));
        const delta = amount(move.amount);
        if (["advance", "cost"].includes(move.kind as string) && delta.compare(zero) < 0)
          throw new Error(
            "Advance/cost requires nonnegative amount; use supported_adjustment for reversal",
          );
        movements = movements.add(delta);
      }
      const ids = account.earnings_line_ids;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        new Set(ids).size !== ids.length ||
        !ids.every(id => typeof id === "string")
      )
        throw new Error("Explicit nonduplicate eligible earnings_line_ids required");
      for (const id of ids) {
        if (allocated.has(id)) throw new Error("Overlapping recoupment allocation: " + id);
        const item = byId.get(id);
        if (!item || item.currency !== ccy)
          throw new Error("Unavailable earnings or mixed currency: " + id);
        earnings = earnings.add(item.expected_amount);
        evidence = evidence.concat(item.evidence_refs);
      }
      const available = opening.add(movements);
      if (available.compare(zero) < 0)
        throw new Error("Movements produce negative unrecouped balance; manual workpaper required");
      const remainder = available.sub(earnings),
        excess = earnings.sub(available);
      const closing = remainder.compare(zero) > 0 ? remainder : zero,
        payable = excess.compare(zero) > 0 ? excess : zero;
      const reported = amount(account.reported_closing_balance, "reported_closing_balance");
      recoupment.push({
        account_id: identity,
        currency: ccy,
        opening_balance: opening,
        movements,
        eligible_earnings: earnings,
        closing_balance: closing,
        reported_closing_balance: reported,
        closing_variance: closing.sub(reported),
        potential_payable: payable,
        earnings_line_ids: ids,
        evidence_refs: [...new Set(evidence)].sort(),
        cash_received: null,
      });
      ids.forEach(id => allocated.add(id));
    } catch (error) {
      errors.push({
        account_id: account.account_id,
        reason: (error as Error).message,
        status: "manual_workpaper_required",
      });
    }
  }
  return entitlementResultSchema.parse(
    JSON.parse(
      JSON.stringify({
        schema_version: "1",
        status: errors.length || !results.length ? "partial" : "ok",
        lines: results,
        recoupment_accounts: recoupment,
        blockers: errors,
        rounding_policy:
          "Exact supported arithmetic: inputs <=24 coefficient/integer digits and <=18 fractional places; <=10000 records per collection; Decimal precision 128. No per-row rounding.",
        limitations:
          "Calculates supplied rules only. Variances are potential exposure, not recognized debt or recovered cash.",
      }),
    ),
  );
}
