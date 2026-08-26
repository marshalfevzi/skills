25 minutes for 400 files is a symptom, not a problem in itself — a suite that size should finish in a fraction of that, and the fact that it's trending upward means something is compounding (more files, slower tests, or state pollution that makes tests do more work over time). Before I recommend anything concrete, I need to understand where the time actually goes, because the fix differs wildly depending on whether it's dominated by a few slow database tests, by thousands of tiny tests each paying startup cost, or by serialization/ordering constraints.

Here is the discovery pass I'd run the moment you point me at the repo (all read-only — no test code will be touched):

- **Map the suite**: enumerate the ~400 files (`*.test.ts` / `*.spec.ts`), check `package.json` for a stale Jest/Vitest config, and look for `bunfig.toml` to see what test settings, preloads, and ignore patterns already exist.
- **Time the run**: get a baseline and find the outliers — how many of the 25 minutes are a handful of files, and how many files take < 1 second.
- **Find the Postgres usage**: which test files actually connect to the database, whether they share one database or one connection per file, and whether they clean up after themselves.

A few of the questions I need answered before I can commit to a strategy — I want to be at ~95% confidence before proposing a plan:

1. **Where does the time go?** Do you have a recent JUnit/`bun test --reporter=junit` report, or an intuition for whether it's a few very slow files vs. broad slowness across the suite?
2. **CI environment**: how many machines/cores does the CI job run on today, and is there a hard wall-clock budget (e.g., "must stay under 10 minutes")?
3. **The Postgres tests**: do they hit a real shared database, and is that a hard requirement (integration tests against real Postgres) or would mocks be acceptable for the fast paths? Can the DB-backed tests run concurrently, or do they mutate shared state that would make them collide?
4. **Test independence**: do the 400 files share state with each other (module-level singletons, env vars, files, ports)? If order matters, that constrains how aggressively we can parallelize.
5. **Do you need the DB in CI at all**, or is a throwaway/ephemeral instance fine (e.g., spun up per run or per job)?
6. **Failure behavior**: do you want the run to stop early on the first failure (`--bail`), or always complete so you see every failure in one pass?

What I'm already suspecting, so you know where my head is (hypotheses only — I won't act on these until you confirm):

- **Parallelize within files where safe**: Bun's `test.concurrent` overlaps async tests in the same file, which is often the single biggest win for I/O-heavy suites — but only if those tests are truly isolated. The DB tests are the prime candidates for either true concurrency or for being *excluded* from concurrency if they share state (`test.serial` opts back out).
- **Separate the DB-heavy integration tests from the fast unit tests** so the slow tail doesn't block the bulk of the suite, and so DB tests can run against an isolated database with `.env.test` (`bun test --env-file=.env.test`) instead of polluting anything shared.
- **Verify cleanup**: leaky `afterEach`/`onTestFinished` cleanup (open connections, leftover rows, timers) is a classic cause of "gets worse over time" — suites that don't clean up get slower as the database fills with junk.
- **Fix ordering-flakiness, not just speed**: if tests only fail in full-suite runs, `randomize = true` in `bunfig.toml` surfaces state-dependency bugs quickly, and `--bail` gives you fast feedback while iterating.

Two asks before I do anything else: (1) run `bun test` with a JUnit reporter and share the report so I can see the actual distribution, and (2) confirm whether I should treat the Postgres tests as mockable or as must-hit-real-DB. Once I have those answers plus your input on the questions above, I'll come back with a concrete, prioritized plan and wait for your approval before writing or changing a single line of test code.
