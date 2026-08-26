Got it — 50% coverage today, target 80%, React app, and you want the components tested properly with Bun. Before I write a single line of test code, I need to do discovery and interrogation first: this skill's flow forbids implementation until you've approved a strategy, so this turn is about nailing down the requirements.

**Discovery & Audit (what I'll inspect before touching anything)**

To ground the plan in your actual repo, I'll audit:

- Existing test files (`*.test.tsx`, `*.spec.tsx`, `*.test.ts`) and where they live — which areas of the app already have coverage
- How the current 50% is measured: Bun's built-in coverage (`bun test --coverage`) or a legacy runner (Jest/Vitest/istanbul)? The measurement tool determines whether we're comparing like for like
- `package.json` and config files for an existing framework and whether React Testing Library is already installed
- `bunfig.toml` for existing `[test]` config (preloads, path ignore patterns, coverage settings)

**Deep Interrogation**

To hit 80% and keep it there, I need ~95% confidence on the requirements. Key questions:

1. Where is the current 50% concentrated — components, hooks, utils, or the data/API layer? What's the rough split?
2. Which critical paths MUST be covered (auth, checkout, forms, routing, data fetching)?
3. What external dependencies need mocking — network calls (fetch/axios), router, state management, third-party UI libraries?
4. DOM testing: OK to set up `happy-dom` via a preload script with React Testing Library? (Bun's native DOM option — and in Bun 1.4, `console.log` works fine under happy-dom.)
5. Which components are hardest to test today — heavy containers, context providers, portals, timers/animations, browser-only APIs?
6. CI constraints: time budget per run, do you need JUnit/LCov reports, and should I enforce 80% as a hard gate (`coverageThreshold = 0.8` fails the build below it)?
7. Sequential execution or `test.concurrent` by default for this suite?
8. How large is the suite and where does it run — should I plan for `--parallel` worker processes, `--shard` splitting across CI machines, or `--timings`-based balancing (Bun 1.4)?

**Preliminary Strategy Recommendation** (for your approval — I won't write tests until you confirm)

My lean, pending your answers:

- **Measure consistently**: run coverage with `bun test --coverage` (with `coverageSkipTestFiles = true` so test files don't inflate the numbers) and gate at 80% via `coverageThreshold = 0.8` in `bunfig.toml`, so the target is enforced, not aspirational.
- **Set up DOM testing**: `happy-dom` global registrator wired in as a `[test]` preload, plus `@testing-library/react` and `@testing-library/user-event` for realistic interactions.
- **Prioritize by leverage, not line-chasing**: hooks and pure logic first (cheap, high-value, deterministic — `setSystemTime` for time-sensitive code), then leaf/presentational components, then interaction-heavy containers with `waitFor`, `user-event`, and mocked network modules.
- **Mock at module boundaries**: `mock.module` for API clients and fetch so component tests exercise rendering and behavior, not live backends.
- **Report in CI**: `--coverage-reporter=lcov` plus JUnit output for dashboards, and `test.failing` for any known-broken paths while we work toward the gate.

Answer the questions above (or just say "use your judgment on the defaults") and I'll come back with the concrete plan and start implementing.
