# Skill Benchmark: bun-test-runner

**Model**: <model-name>
**Date**: 2026-08-26T14:57:55Z
**Evals**: 1, 2, 3, 4 (1 runs each per configuration)

## Summary

| Metric | With Skill | Old Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 94% ± 12% | 69% ± 31% | +0.25 |
| Time | 35.0s ± 2.9s | 38.1s ± 17.9s | -3.1s |
| Tokens | 0 ± 0 | 0 ± 0 | +0 |

## Notes

- Eval 4 (ci-scaling-parallel) fully discriminates: with_skill passes all three Bun 1.4 scaling assertions (--parallel, --shard/--timings, BUN_TEST_WORKER_ID); old_skill fails all three. New skill content drives the recommendation, not baseline model knowledge.
- Eval 1 (greenfield-time-sensitive) is non-discriminating — all 4 assertions pass in both configs. Expected: it tests the interrogation flow both skill versions mandate.
- Eval 2 (jest-migration) is near non-discriminating: 3/4 pass both; the only split is '--update-snapshots' flag naming, which the old_skill response omitted despite mentioning snapshot updates.
- Eval 3 (react-coverage) assertion 'mentions /// <reference lib="dom" />' fails in BOTH configs — the with_skill first-turn response covered happy-dom/RTL/coverage/CI but did not dump the TS reference directive. Implementation-detail assertion, weak for a first-turn interrogation eval; candidate for sharpening or removal in iteration 2.
- Old-skill pass-rate spread (100/75/75/25 across evals) is between-eval variance driven by eval 4, not run flakiness — 1 run per configuration this iteration, so stddev reflects eval mix, not repeatability.
- Token data unavailable (harness did not expose total_tokens); timing recorded from completion notifications (with_skill 35.0s mean vs old_skill 38.1s).