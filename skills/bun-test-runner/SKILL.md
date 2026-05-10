---
name: bun-test-runner
description: Master Bun's high-performance, Jest-compatible test runner. Use this skill to architect, implement, and migrate rigorous testing suites with sub-millisecond overhead, built-in mocking, snapshot testing, DOM support (happy-dom), and native TypeScript type testing.
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

### 3. Strategy Recommendation
Present a clear plan to the user and **wait for approval**:
- **Migration**: "I will migrate 15 Jest tests to Bun, replacing `jest.mock` with `mock.module` and updating snapshots."
- **Greenfield**: "I will implement a TDD suite for the `UserService`, using `bun:test` spies and `setSystemTime` for time-sensitive logic."
- **UI Testing**: "I will configure `happy-dom` via a preload script and implement React Testing Library components tests."

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
```

### Async & Timeouts
- **Async/Await**: `test("async", async () => { ... })`
- **Done Callback**: `test("done", (done) => { ...; done(); })`
- **Timeouts**: Pass ms as 3rd arg: `test("slow", fn, 10000)`. Default is 5000ms.
- **Zombie Process Killer**: Bun automatically kills child processes (`Bun.spawn`) on test timeout.

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

### Dates & Times
```ts
import { setSystemTime } from "bun:test";
setSystemTime(new Date("2020-01-01"));
// Reset: setSystemTime();
```
- Supports `jest.useFakeTimers()` and `jest.setSystemTime()`.
- Note: Bun's `Date` constructor does *not* change when faking timers (unlike Jest).

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

### Type Testing
```ts
import { expectTypeOf } from "bun:test";
test("types", () => {
  expectTypeOf<MyType>().toEqualTypeOf<{ id: string }>();
});
```
*Note: Requires `tsc --noEmit` to actually catch errors in CI.*

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
```

### CLI Power Commands
- `bun test --watch`: Watch mode.
- `bun test --coverage`: Console coverage report.
- `bun test --coverage-reporter=lcov`: Generate `lcov.info`.
- `bun test --reporter=junit --reporter-outfile=report.xml`: CI reporting.
- `bun test -t "pattern"`: Filter by test name (regex).
- `bun test --bail`: Stop after first failure.

## Best Practices
- **Concurrency**: Use `test.concurrent` for performance unless tests share state.
- **Isolation**: Always clean up side effects (files, DB) in `afterEach` or `onTestFinished(() => ...)`.
- **Failing Tests**: Use `test.failing` for TDD to track bugs without breaking CI.
- **Resource Management**: Use `onTestFinished` for per-test cleanup (safer than `afterEach` for concurrent tests).
- **Environment**: Use `.env.test` and load with `bun test --env-file=.env.test`.
