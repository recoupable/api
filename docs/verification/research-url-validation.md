# Research URL validation successor

Owner: [Mono #358](https://github.com/recoupable/mono/issues/358).
Original [API #642](https://github.com/recoupable/api/pull/642), exact head
`481ec02d503d435a64b41034f148c1e5b94ee67d`, remains untouched on retired `test`.
Current-main base: `934bbe57fc163bfecc14f618a0e8c56c60623378`.
The original gap was inspected at `bcc3052256863540e15905b8ac945b183e8dc1b1`;
the subsequent main change updates only `lib/contracts/fixtures/published-docs.json`.
Research URL implementation and tests are unchanged across those bases.
The original ten-file patch was compared with current handler/normalizer paths;
its shared URL rule, valid-field fallback and response filtering were absent.
Open API #1006 changes Context enrichment paths rather than these URL adapters.

## Selected original intent

- Share one syntax rule: a parseable HTTPS URL with a hostname and no embedded
  username/password. Helper names describe this rule rather than implying that
  a domain has been independently trusted.
- Choose the first qualifying `url`, `link` or `href`; an invalid earlier field
  must not hide a later valid one. Do not recursively add the chosen record's
  link fields again under generic keys after retaining its platform label.
- Apply the same rule to bare strings, provider URL normalization and the public
  `GET /api/research/urls` output.
- Preserve valid existing array responses as well as map responses. The retired
  branch's formatter would drop every array, while current main explicitly accepts
  arrays. This successor keeps valid documented `{ domain, url }` entries and
  filters invalid ones in either shape.

HTTP, malformed, non-web and credential-bearing links are omitted. Returned links
are not requested or followed. This is not a domain allowlist/reputation check or
an SSRF defense for another server-fetch capability. No network host validation,
redirect resolution, authentication, provider selection, credit logic, schema,
permissions or catalog contract is changed.

## Verification and remaining authority

Five route/normalizer regressions fail at the current-main base. Corrected tests
exercise the actual GET export, shared normalization and provider adapter with
synthetic validation/research/provider leaves. They preserve auth/credit denial
and failed research status/body, retain valid array entries, reject other schemes
and credentials, and retain later qualifying link fields without duplicate keys.
No real account, customer, provider, payment or database request is made.

Provider responses in fixtures are synthetic; no production data-quality or
client-rendering result is claimed. The original PR's intent does not authorize
another provider, new polling or commercial expansion. The existing shared
research operation and its pricing behavior remain in place. Source merge,
publication companions and any old-PR closure remain coordinator-owned. This
slice does not complete #358's inventory or modify the held stream/SDK/App work.
