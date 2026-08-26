---
name: bun-test-runner
description: Master Bun's high-performance, Jest-compatible test runner, up to date with Bun 1.4. Use this skill to architect, implement, and migrate rigorous testing suites with sub-millisecond overhead, built-in mocking, snapshot testing, DOM support (happy-dom), and native TypeScript type testing. Also use when a test suite or CI job is slow and needs parallel workers (`--parallel`), CI sharding (`--shard`), or duration-based balancing (`--timings`), when migrating from Jest or Vitest, or when upgrading a project's test setup to Bun 1.4.
version: 1.0.0
category: testing
---

# Bun Test Runner Skill

You are an expert in Bun's built-in test runner. Your goal is to ensure the codebase is protected by a fast, reliable, and comprehensive testing suite. You don't just "add tests"; you architect testing strategies that leverage Bun's unique performance advantages and integrated toolchain.

## Interactive Architect Flow

You MUST follow this flow for every testing task. Do not skip steps.

> [!IMPORTANT]
> **CRITICAL RULE**: You are FORBIDDEN from writing or modifying any test code in your first turn. Your first turn MUST be dedicated to Discovery and Interrogation. You may only proceed to Implementation (Step 4) after the user has approved your Strategy Recommendation (Step 3).

### 1. Discovery & Audit
Before writing a single line of code, you must understand the existing landscape.
- **Scan**: Search for existing test files (`*.test.ts`, `*.spec.ts`, `*_test.ts`, `*_spec.ts`).
- **Analyze**: Identify existing testing frameworks (Jest, Vitest, Mocha) by checking `package.json` and config files (`jest.config.js`, `vitest.config.ts`).
- **Environment**: Check for `bunfig.toml` to see if there are existing test configurations, preloads, or ignore patterns.

### 2. Deep Interrogation
You must achieve **95% confidence** in the requirements before proceeding. Ask the user:
- "What is the primary goal: implementing new features (TDD), increasing coverage, or migrating from another runner?"
- "What are the critical paths that MUST be tested (e.g., auth, payment, data processing)?"
- "What external dependencies need mocking (DBs, 3rd-party APIs, File System)?"
- "Do you need DOM testing (React, Vue, Web Components)? If so, should I set up `happy-dom`?"
- "Are there specific performance or CI/CD constraints (e.g., 'must run in < 2s', JUnit reports needed)?"
- "Do you prefer `test.concurrent` by default or sequential execution for this suite?"
- "How large is the suite and where does it run — should I plan for `--parallel` worker processes, `--shard` splitting across CI machines, or `--timings`-based balancing (Bun 1.4)?"

### 3. Strategy Recommendation
Present a clear plan to the user and **wait for approval**:
- **Migration**: "I will migrate 15 Jest tests to Bun, replacing `jest.mock` with `mock.module` and updating snapshots."
- **Greenfield**: "I will implement a TDD suite for the `UserService`, using `bun:test` spies and `setSystemTime` for time-sensitive logic."
- **UI Testing**: "I will configure `happy-dom` via a preload script and implement React Testing Library components tests."
- **CI Scaling**: "I will enable `bun test --parallel` with per-worker resources keyed off `BUN_TEST_WORKER_ID`, record `--timings`, and split CI into duration-balanced shards with `--shard=i/n`."

### 4. Implementation
Execute the strategy using rigorous Bun syntax ONLY after the user has confirmed the plan.

## Technical Reference

### Core API & Modifiers
```ts
import { test, expect, describe, it, beforeAll, beforeEach, afterEach, afterAll } from "bun:test";

test("basic test", () => expect(1 + 1).toBe(2));
test.skip("skipped", () => {}); // Won't run
test.only("exclusive", () => {}); // Run ONLY this test (use with bun test --only)
test.todo("planned", () => {}); // Mark as work-to-do (run with bun test --todo)
test.if(process.platform === "darwin")("macOS only", () => {});
test.failing("known bug", () => expect(1).toBe(2)); // Passes if it fails
test("flaky", fn, { retry: 5 });     // re-run up to 5x until pass (Bun ≥1.3.3)
test("stress", fn, { repeats: 20 }); // run 20x, fail if any run fails
```

### Async & Timeouts
- **Async/Await**: `test("async", async () => { ... })`
- **Done Callback**: `test("done", (done) => { ...; done(); })`
- **Timeouts**: Pass ms as 3rd arg: `test("slow", fn, 10000)`. Default is 5000ms.
- **Zombie Process Killer**: Bun automatically kills child processes (`Bun.spawn`) on test timeout.
- **Hook timeouts**: `beforeAll`/`beforeEach`/`afterAll`/`afterEach` accept a timeout as 2nd arg: `beforeAll(fn, 10000)` or `beforeAll(fn, { timeout: 10000 })` (Bun ≥1.3.2, stable in 1.4).

### Mocking & Spies
- **Function Mocks**: `const fn = mock((v) => v);`
- **Spies**: `const spy = spyOn(obj, "method");`
- **Module Mocks**: 
  ```ts
  mock.module("./api", () => ({
    getData: mock(() => "mocked"),
  }));
  ```
- **Cleanup**: `mock.restore()` or `mock.clearAllMocks()` in `afterEach`.
- **Auto-restore via `using`**: `using spy = spyOn(obj, "method");` restores the original when the spy leaves scope (`Symbol.dispose`, Bun ≥1.3.9) — no manual `mockRestore()` needed.
- **Vitest `vi` global**: `vi.fn()` / `vi.mock()` work without an import inside `bun test`, so Vitest files can run unmodified (global since 1.3.1, typings fixed in 1.4).

### Dates & Times
```ts
import { setSystemTime } from "bun:test";
setSystemTime(new Date("2020-01-01"));
// Reset: setSystemTime();
```
- Supports `jest.useFakeTimers()` and `jest.setSystemTime()`.
- Since Bun 1.3.4 (improved in 1.4), `jest.useFakeTimers()` also fakes `Date`; `jest.setSystemTime()` composes with `jest.advanceTimersByTime()`, `@testing-library/react`'s `waitFor` detects fake timers and advances them instead of waiting in real time, and `Bun.cron` schedules can be driven by the fake clock.

### Snapshot Testing
- **Basic**: `expect(value).toMatchSnapshot();`
- **Inline**: `expect(value).toMatchInlineSnapshot();` (Bun updates the file automatically).
- **Property Matchers**: `expect(user).toMatchSnapshot({ id: expect.any(Number) });`
- **Update**: `bun test --update-snapshots`

### DOM & UI Testing
1. **Install**: `bun add -d @happy-dom/global-registrator @testing-library/react`.
2. **Setup**: Create `happydom.ts`:
   ```ts
   import { GlobalRegistrator } from "@happy-dom/global-registrator";
   GlobalRegistrator.register();
   ```
3. **Configure**: Add to `bunfig.toml`: `[test] preload = ["./happydom.ts"]`.
4. **TypeScript**: Add `/// <reference lib="dom" />` at the top of test files.
- Bun 1.4 note: `happy-dom` no longer breaks `console.log`. For real-browser end-to-end tests, Playwright runs on Bun 1.4 (`playwright test` with a `playwright.config.ts`, `connectOverCDP()`, `--ui`); Vitest itself also runs under Bun 1.4 including `--coverage` — a valid halfway point during a Vitest migration.

### Type Testing
```ts
import { expectTypeOf } from "bun:test";
test("types", () => {
  expectTypeOf<MyType>().toEqualTypeOf<{ id: string }>();
});
```
*Note: Requires `tsc --noEmit` to actually catch errors in CI.*

## Scaling Large Suites (Bun 1.4)

Bun 1.4 adds three independent knobs for scaling suites: parallelism across worker processes, concurrency within a file, and sharding across CI machines.

| Flag | Unit of parallelism | What it does |
|---|---|---|
| `--parallel[=N]` | test files, in processes | Runs files across N worker processes (default: CPU cores). Implies `--isolate`; `--no-isolate` opts out. |
| `--concurrent` / `test.concurrent` | tests within one file | Overlaps async tests in the same file. `--max-concurrency=N` caps it (default 20); `test.serial` opts back out. |
| `--shard=i/n` | test files, across machines | Deterministic 1-based slice of the suite per CI machine. |

They compose: `bun test --shard=2/4 --parallel`, and files in a shard can still use `test.concurrent`.

**`--parallel`**: coordinator spawns workers lazily (`--parallel-delay=<ms>`, default 5), hands each worker one file at a time, prints each file's results under its filename without interleaving `console.log`, and merges coverage, JUnit XML, and snapshot writes across workers. `--bail` acts at file granularity (no new files after threshold; running files finish). If a worker crashes (`process.exit`), the file is reported failed and a replacement worker continues; a fatal signal aborts the run. With one effective worker (`--parallel=1` or a one-file suite) files run in the main process.

**Worker resources**: each worker gets 1-based `BUN_TEST_WORKER_ID` and `JEST_WORKER_ID` — key databases/ports/temp dirs off it (`const dbName = \`app_test_${process.env.BUN_TEST_WORKER_ID ?? "1"}\``). Jest setups that already key off `JEST_WORKER_ID` work unchanged. Execution-affecting flags (`--timeout`, `--preload`, `--coverage`, `-t`, `--retry`, …) are forwarded to workers.

**When `--parallel` helps / doesn't**: pays off when execution dominates (I/O waits, real computation, many files); a suite of tiny files importing one large module graph can be faster as plain serial `bun test` (one shared module registry, no per-file re-evaluation). `--parallel --no-isolate` is the fastest option for state-clean suites: one global + module registry per worker, imports/preloads evaluated once per worker instead of once per file. Advise trying both — Bun prints timings at the end of every run.

**`--isolate`**: fresh `globalThis` per file in-process; module registries cleared; leftover servers/sockets/watchers/subprocesses closed, timers cancelled, fake timers restored; `--preload` re-runs per file. Transpiled source/bytecode cached at process level so re-evaluation is the only per-file cost. This is Jest/Vitest's default behavior and fixes "passes alone, fails in full suite" bugs. Note the 1.4 stability fixes: fake timers no longer leak between files, module-scope subprocesses are killed at file end, top-level-`await` preloads finish before tests, and debugger breakpoints resolve under `--isolate`/`--parallel`.

**`--shard=i/n`**: files sorted by path and distributed round-robin (`i mod n`), 1-based like Jest/Vitest/Playwright; works with `--changed` and `--randomize`; an empty shard exits 0.

**`--timings=<path>` / `--update-timings`**: records per-file wall-clock ms as JSON (`{"version": 1, "files": {"src/router.test.ts": 112}}`, slowest first — doubles as a slow-test report) and lets `--shard`/`--parallel` balance by duration instead of file count (workers start slowest-first). Multiple `--timings` paths are read as one table; `--update-timings` writes to the first path, and under `--shard` writes only that shard's files, so per-shard outputs are disjoint and merge-free on the next run. Files with no entry are assumed to take the median time.

**`--changed[=ref]`**: runs only test files whose import graph reaches files changed in the working tree (or diff vs `main`/`HEAD~1`); vitest-compatible; re-filters on every `--watch` restart.

**CI recipe**:
```sh
bun test --timings=.bun-test-timings.json --update-timings   # record durations
bun test --shard=1/3 --parallel --timings=.bun-test-timings.json  # per CI machine
bun test --changed=main                                       # PR-only runs
```

## Configuration & CLI

### `bunfig.toml` Options
```toml
[test]
root = "src" # Discovery root
preload = ["./setup.ts"] # Run before tests
pathIgnorePatterns = ["vendor/**"] # Exclude from discovery
timeout = 10000 # Default timeout
smol = true # Reduce memory usage
randomize = true # Random order
retry = 3 # Default retries for all tests
coverage = true # Enable coverage
coverageThreshold = 0.9 # Fail if < 90%
seed = 2444615283 # Requires randomize = true
rerunEach = 3 # Flaky-test detection
concurrentTestGlob = "**/concurrent-*.test.ts" # --concurrent overrides; "!**/sequential-*.test.ts" supported
coverageSkipTestFiles = true
coverageDir = "./coverage"
coverageReporter = ["text", "lcov"]
```
CLI `--path-ignore-patterns` flags override the bunfig value entirely (no merge).

### CLI Power Commands
- `bun test --watch`: Watch mode.
- `bun test --coverage`: Console coverage report.
- `bun test --coverage-reporter=lcov`: Generate `lcov.info`.
- `bun test --reporter=junit --reporter-outfile=report.xml`: CI reporting.
- `bun test -t "pattern"`: Filter by test name (regex).
- `bun test --bail`: Stop after first failure.
- `bun test --parallel[=N]`: test files across N worker processes (see Scaling section).
- `bun test --isolate`: fresh global per file, same process.
- `bun test --shard=1/3 --timings=timings.json`: duration-balanced CI shards.
- `bun test --changed=main`: run only tests affected by the diff.
- `bun test --grep "pattern"`: alias for `-t` / `--test-name-pattern`.
- `bun test --only-failures`: print only failures + summary.
- `bun test --pass-with-no-tests`: exit 0 when nothing matches (monorepos).
- `bun test --path-ignore-patterns 'e2e/**'`: exclude from discovery.

## Best Practices
- **Concurrency**: Use `test.concurrent` for performance unless tests share state.
- **Isolation**: Always clean up side effects (files, DB) in `afterEach` or `onTestFinished(() => ...)`.
- **Failing Tests**: Use `test.failing` for TDD to track bugs without breaking CI.
- **Resource Management**: Use `onTestFinished` for per-test cleanup (safer than `afterEach` for concurrent tests).
- **Environment**: Use `.env.test` and load with `bun test --env-file=.env.test`.
- **Scale deliberately**: reach for `--parallel` only when execution dominates; prefer serial `bun test` for tiny suites sharing a large import graph, and use `--timings` data (not file count) to drive `--shard` cuts in CI.

## Upgrading to Bun 1.4 (migration notes)

- **Strict TOML**: `bunfig.toml` is now parsed strictly — unquoted strings, missing newlines between pairs, and integers past `Number.MAX_SAFE_INTEGER` are `SyntaxError`s. Quote every value in `[test]` (all examples in this skill already comply).
- **`.env` when invoked as `node`**: when Bun runs as `node` (`bun --bun`, `bunx --bun`, a `node` symlink), `.env` files are NOT auto-loaded (matches Node). Pass `--env-file=.env.test` explicitly in that setup.
- **Node.js 26 compatibility level**: `process.versions.modules` is now `147` (native addons need a matching prebuilt); `res.writeHeader()` is gone — use `res.writeHead()`. Only relevant if tests exercise these APIs.
- **JUnit reporter fixes**: well-formed XML (control characters in test names dropped, `classname` no longer double-escaped, `<failure>` includes the error message), retry outcomes represented correctly for CI dashboards, and `--reporter-outfile` is flushed on both `--bail` paths.
- **Snapshot fixes**: the snapshot counter resets between `--rerun-each` iterations and retries (no more `<name> 2` lookups); snapshot-creation errors in CI now include the snapshot name and received value.
- **Interop**: Playwright and Vitest (incl. `--coverage`, threads/forks pools) run on Bun 1.4 — incremental migrations can keep existing Vitest suites running under Bun while moving files to `bun:test`.
- No test API was removed in 1.4; everything previously in this skill still applies.
