# bun-test-runner eval fixture

- Purpose: first-turn behavior evals for the bun-test-runner skill after its Bun 1.4 update (`--parallel`, `--isolate`, `--shard`, `--timings`, `--changed`, migration notes). Baseline is the pre-update skill snapshot (`old_skill`), so the signal is the new content, not baseline model knowledge.
- Configuration: each eval runs twice — `with_skill` reads `skills/bun-test-runner/SKILL.md`; `old_skill` reads the pre-update `SKILL.md` snapshot taken before editing (kept outside the committed tree).
- Eval style: conversation-flow evals. The chat response IS the artifact: each subagent followed the skill's Interactive Architect Flow and produced exactly one first-turn response, saved verbatim to `outputs/response.md`. No input files; the flow forbids writing or modifying test code before user approval.
- Model: session model (opencode-go/deepseek-v4-flash); runs were executed by `task` subagents, one per eval × configuration.
- Timing: wall-clock run duration captured from completion notifications (`timing.json`). The harness did not expose `total_tokens`; values are recorded as null and are not a quality metric.
- Grading: 4 assertions per eval, graded against `outputs/response.md` with quoted evidence; `grading.json` uses `text`/`passed`/`evidence` field names that the eval viewer depends on.
- Expected signal: eval 4 (`ci-scaling-parallel`) assertions on `--parallel`, `--shard`/`--timings`, and `BUN_TEST_WORKER_ID` should pass only with the updated skill — the snapshot predates Bun 1.4 and cannot recommend those flags. Evals 1–3 check that the interrogation flow is unchanged.
