That's a classic "execution-dominated suite" profile — 400 files, real Postgres I/O, and a wall-clock that keeps climbing. Bun 1.4 ships three knobs built exactly for this, but before I recommend a concrete setup I need to interrogate a few things. Per my working flow, I won't touch any test code until you approve a plan.

**Discovery & interrogation questions** (a proper audit would scan your test files, `package.json`, and `bunfig.toml`; starting from what you've told me):

1. **CI topology**: How many CI machines can you run in parallel? This decides whether `--shard=i/n` is even useful — with 400 files, even a single beefy machine gets a big win from `--parallel` alone.
2. **Where does the 25 minutes actually go?** Is it dominated by the Postgres-hitting files, spread evenly across files, or eaten by per-file startup/import cost? The fastest way to find out: run `bun test --timings=.bun-test-timings.json --update-timings` once — it records per-file wall-clock ms (slowest first) and doubles as a slow-test report. That tells us whether to balance by duration or by file count.
3. **Postgres setup**: Do the DB-touching tests share one database, or does each test/suite create its own schema? Is Postgres local to each CI runner or a shared service? Can each parallel worker get its own database or port? This is the #1 collision risk with `--parallel`: multiple workers hammering one schema will clobber each other's migrations and data.
4. **Isolation**: Do tests leak global state today (timers, sockets, module-scope subprocesses, fake timers)? Any "passes alone, fails in full suite" bugs? That determines how aggressively we can use `--no-isolate`.
5. **CI reporting**: Do you need JUnit XML, coverage, or a specific exit-code contract from the run?
6. **Failure policy**: Do you want the run to stop after N file failures (`--bail`), or always execute everything?

**Initial strategy direction** (I'll refine it once you answer):

- **Spread files across processes**: `bun test --parallel` runs one file per worker process (default: one per CPU core). With 400 files where execution dominates, this is the biggest lever — and since it implies `--isolate`, it also fixes the "passes alone, fails in full suite" class of bugs for free.
- **Give each worker its own database**: key per-worker resources off `BUN_TEST_WORKER_ID` (1-based; `JEST_WORKER_ID` is also set, so existing Jest keying keeps working) — e.g. `const dbName = \`app_test_${process.env.BUN_TEST_WORKER_ID ?? "1"}\`` — so parallel workers never collide on migrations or data.
- **Balance CI by duration, not file count**: record `--timings`, then split across machines with `bun test --shard=1/3 --parallel --timings=timings.json` — with timings data, workers start slowest-first, so one slow Postgres-heavy file doesn't hold an entire shard hostage.
- **Trim PR runs**: `bun test --changed=main` runs only test files whose import graph reaches changed files — cheap PR feedback, full suite on merge.

The shape of the CI recipe once we've tuned it:

```sh
bun test --timings=.bun-test-timings.json --update-timings          # record durations
bun test --shard=1/3 --parallel --timings=.bun-test-timings.json    # per CI machine
bun test --changed=main                                             # PR-only runs
```

One caveat: `--parallel` pays off when execution dominates. If the 25 minutes is actually the import cost of a large shared module graph re-evaluated per file, serial `bun test` (or `--parallel --no-isolate` for state-clean suites) can be faster — the timings file will tell us which regime you're in.

Answer the six questions above (especially #1, #2, and #3) and I'll turn this into a concrete step-by-step plan for your approval. No test code changes until then.
