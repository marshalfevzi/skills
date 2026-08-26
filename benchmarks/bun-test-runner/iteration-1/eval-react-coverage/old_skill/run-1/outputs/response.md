Got it — 50% → 80% coverage on a React app, tested with Bun. That's very achievable, but before I write a single test I need to run my discovery and interrogation pass so the plan targets the code that actually matters. I'm not going to write or modify any test code yet — the first step here is understanding your suite and your app.

## What I'll audit first (Discovery & Audit)

Once you give me the go-ahead to look at the repo, I'll scan for:

- **Existing test files** — `*.test.ts`, `*.test.tsx`, `*.spec.tsx`, and friends — to see what's already covered and what the current 50% is made of.
- **Testing framework** — is this already on `bun:test`, or still Jest/Vitest? I'll check `package.json` and any `jest.config.js` / `vitest.config.ts` to see if a migration is needed before coverage work.
- **`bunfig.toml`** — whether `[test]` is configured with `coverage = true`, a `coverageThreshold`, a `root` for discovery, preloads, or ignore patterns.
- **Where the uncovered 50% lives** — I'll pull a coverage report and identify the biggest, riskiest gaps: untested components vs. untested logic (hooks, utilities, API layers). Component testing alone rarely gets you from 50% to 80%; the missing coverage is usually in the non-UI code paths.

## Questions before I recommend a strategy (Deep Interrogation)

To get to ~95% confidence in the plan, I need a few answers:

1. **Primary goal**: Purely raising coverage to 80%, or are there critical paths you want guaranteed? Is 80% a hard CI gate or a target?
2. **Critical paths**: What are the must-test flows — auth, forms, data fetching, payments, routing? I'll prioritize those over chasing the coverage number blindly.
3. **External dependencies**: What needs mocking — API calls, localStorage/sessionStorage, third-party providers (auth, analytics), timers? This drives how much `mock.module` / `spyOn` work is involved.
4. **DOM setup**: Can I configure `happy-dom` for the component tests? It's the standard Bun path — I'd set up `@happy-dom/global-registrator` via a preload script and use React Testing Library for rendering and interaction. Any components that depend on real browser APIs (canvas, matchMedia, IntersectionObserver) will need special handling — worth knowing now.
5. **Performance / CI constraints**: Any requirement like "the suite must stay under N seconds" or JUnit reports for CI? Do you want coverage thresholds enforced in CI (`coverageThreshold = 0.8`), and should I set up `lcov` reporting for your coverage tooling?
6. **Concurrency**: Do you prefer `test.concurrent` by default for these component tests, or sequential execution? React Testing Library tests are usually safe to run concurrently, but shared state (mocked modules, fake timers) can bite.

## What happens next

1. I present a **Strategy Recommendation** — e.g., "configure `happy-dom` via a preload script, add React Testing Library, set `coverageThreshold = 0.8` in `bunfig.toml`, and implement component tests for the highest-gap screens plus unit tests for the untested logic" — and wait for your approval.
2. Only after you approve do I start implementing tests.

Could you answer the questions above (or just point me at the repo and let me audit first)? Once I have the lay of the land, I'll come back with a concrete, prioritized plan for closing 50% → 80%.
