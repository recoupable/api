# Routing verification — 2026-09-18

Synthetic live checks against the actual `selectChatModel` implementation and
Vercel AI Gateway. These are targeted smoke evaluations, not a calibrated accuracy
benchmark or proof of output quality/cost savings. No customer data was used.

## Model tiers

20 scenarios run twice (38 live Jev calls plus two attachment-policy bypasses).
Expected tiers were assigned before execution. 38/40 matched exactly; the two
mismatches were the same ordinary action-plan request, conservatively escalated
to Astra high on low tier confidence. All 20 scenarios selected the same model
and effort on both runs. No difficult scenario was routed to a cheaper tier.

| Scenario | Expected | Observed in both runs |
| --- | --- | --- |
| greeting | fast | fast |
| arithmetic | fast | fast |
| rewrite | fast | fast |
| extract | fast | fast |
| definition | fast | fast |
| campaign | balanced | balanced |
| email-draft | balanced | balanced |
| workspace-tools | balanced | balanced |
| research | balanced | balanced |
| summary | balanced | frontier / high |
| concurrency | frontier | frontier / high |
| architecture | frontier | frontier / high |
| strategy | frontier | frontier / high |
| debug | frontier | frontier / high |
| followup-complex | frontier | frontier / high |
| topic-switch | fast | fast |
| injection-cheap | frontier | frontier / high |
| injection-expensive | fast | fast |
| ambiguous | frontier | frontier / high |
| attachment | frontier | frontier / high |

The injection scenarios embedded instructions to force an inappropriate tier;
both were classified by actual task difficulty in these examples. The topic-switch
case returned to fast despite earlier complex context. Attachment routing is an
intentional bypass, not a Jev classification.

## Reasoning exploration

12 additional live, single-run scenarios explored effort selection; these were
exploratory and were not scored against a fixed expected-tier label.

| Scenario | Selected effort | Tier confidence | Effort confidence |
| --- | --- | --- | --- |
| local-fix | high | 0.53 | 0.72 |
| bounded-code | high | 0.47 | 0.3 |
| migration | high | 0.2 | 0.91 |
| api-design | high | 0.35 | 0.8 |
| sql-debug | high | 0.48 | 0.36 |
| algorithm | high | 0.94 | 0.3 |
| webhook | medium | 0.79 | 0.71 |
| component | medium | 0.88 | 0.96 |
| simple-debug | high | 0.42 | 0.99 |
| analysis | high | 0.39 | 0.93 |
| bounded-proof | high | 0.66 | 0.99 |
| parser | medium | 0.83 | 0.94 |

Three selected Astra medium; nine selected high. No automatic low-effort choice
was observed in this sample. Low effort is covered by deterministic selection
and execution tests, but its live selection frequency remains unestablished.
The current policy explicitly raises both model capability and effort when tier
confidence is below 0.7, even when effort confidence is high. This favors quality
but can over-allocate compute on bounded tasks. The threshold was not weakened
to improve the match score.

## Execution checks

Each of five real model configurations was given a harmless `test_sum` tool and
asked to call it with 37 and 58, then return the result. Every configuration called
the tool once, returned `95`, and finished normally:

- google/gemini-3.5-flash-lite: pass (1505 ms).
- moonshotai/kimi-k3: pass (2878 ms).
- openai/gpt-6-astra / low: pass (2537 ms).
- openai/gpt-6-astra / medium: pass (2523 ms).
- openai/gpt-6-astra / high: pass (2467 ms).

Router latency for the 50 live Jev calls: median 228 ms,
range 154–634 ms. Gateway-reported total routing cost:
$0.001263. These exclude execution costs.

## Limits and remaining work

- Synthetic prompts; no production workload distribution or human answer grading.
- Single tool fixture; not broad verification of Recoup's production tools.
- Confidence numbers are classifier outputs, not measured answer correctness.
- Live failures/timeouts were not induced; unit tests cover their fallback paths.
- Router service failures currently retain the existing Kimi fallback; this is
  distinct from low-confidence classification, which escalates to Astra high.
- More representative evaluation is needed before claiming optimal model choices,
  reliable low-effort selection, or quantified savings.
