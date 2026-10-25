import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { calculateEntitlements } from "../calculateEntitlements";
const oracle = fileURLToPath(new URL("./oracle/", import.meta.url));
const fixture = () => JSON.parse(readFileSync(oracle + "input.json", "utf8"));
function python(input: unknown) {
  return JSON.parse(
    execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import sys,json,importlib.util
sys.path.insert(0,sys.argv[1])
spec=importlib.util.spec_from_file_location('calc',sys.argv[1]+'/calculate-entitlements.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
from _finance import dumps
print(dumps(m.calculate(json.load(sys.stdin))))`,
        oracle,
      ],
      { input: JSON.stringify(input), encoding: "utf8" },
    ),
  );
}
describe("canonical entitlement parity", () => {
  it("matches the entire canonical evidenced workpaper", () => {
    const input = fixture();
    expect(calculateEntitlements(input)).toEqual(python(input));
  });
  for (const [name, mutate] of Object.entries({
    leadingDot: (x: any) => {
      x.rules[0].participation_rate = ".5";
    },
    negativeZero: (x: any) => {
      x.lines[0].gross_amount = "-0.000";
    },
    zeroCommission: (x: any) => {
      x.rules[0].commission_rate = "0.00";
    },
    positiveExponentZero: (x: any) => {
      x.lines[0].gross_amount = "0e3";
    },
    exponent: (x: any) => {
      x.lines[0].gross_amount = "1.230e2";
    },
    nullAdjustments: (x: any) => {
      x.lines[0].adjustments = null;
    },
    nullMovements: (x: any) => {
      x.recoupment_accounts[0].movements = null;
    },
    unicodeEvidence: (x: any) => {
      x.lines[0].evidence_refs = ["\ue000", "\u{10000}"];
    },
    subcent: (x: any) => {
      x.lines[0].gross_amount = "0.000000000000000001";
    },
    negative: (x: any) => {
      x.lines[0].gross_amount = "-17.12345";
    },
    missingBasis: (x: any) => {
      delete x.rules[0].basis;
    },
    unsupported: (x: any) => {
      x.rules[0].unsupported_terms = ["escalator"];
    },
    currency: (x: any) => {
      x.lines[0].adjustments[0].currency = "EUR";
    },
    missingEvidence: (x: any) => {
      x.lines[0].evidence_refs = [];
    },
    period: (x: any) => {
      x.lines[0].period_end = "2025-01-01";
    },
    crossCollateral: (x: any) => {
      x.recoupment_accounts[0].cross_collateralization = true;
    },
    doubleDeduction: (x: any) => {
      x.rules[0].already_net_of = ["commission"];
    },
    overlap: (x: any) => {
      x.recoupment_accounts.push({ ...x.recoupment_accounts[0], account_id: "SECOND" });
    },
    noLines: (x: any) => {
      x.lines = [];
      x.recoupment_accounts = [];
    },
  }))
    it(name, () => {
      const input = fixture();
      mutate(input);
      expect(calculateEntitlements(input)).toEqual(python(input));
    });
  it("pins the Python oracle bytes to the reviewed source", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../oracle-manifest.json", import.meta.url), "utf8"),
    );
    for (const [name, hash] of Object.entries(manifest.files))
      expect(
        createHash("sha256")
          .update(readFileSync(oracle + name))
          .digest("hex"),
      ).toBe(hash);
  });
  it("leaves supplied inputs unchanged", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    calculateEntitlements(input);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("rejects malformed version types at the typed boundary", () => {
    const input = fixture();
    input.rules[0].rule_version = 1;
    expect(() => calculateEntitlements(input)).toThrow();
  });
  it("compares a deterministic matrix of signed, exponent and boundary amounts", () => {
    for (const value of [
      "0",
      "-0",
      "0.00",
      "-0.00",
      "1e3",
      "-1e3",
      "1.000e3",
      "1e-18",
      "999999999999999999999999",
      "0.123456789012345678",
      "-9.999999999999999999",
      "12.5",
    ]) {
      const input = fixture();
      input.lines[0].gross_amount = value;
      expect(calculateEntitlements(input)).toEqual(python(input));
    }
  });
  it("rejects unknown versions", () =>
    expect(() => calculateEntitlements({ schema_version: "2" })).toThrow());
});
