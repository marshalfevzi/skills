Migrating a Jest suite to Bun's test runner is a very tractable migration — Bun ships a Jest-compatible runner, and nothing about `bun:test` will surprise you on the mocking or snapshot fronts. Before I touch a single test file, I need to understand your current setup so the migration plan is precise instead of hand-wavy. Per my working flow, this first turn is discovery and interrogation only — I won't write or modify any test code until you've approved a strategy.

Here's what I already know about the good news, so you can see where this is heading:

- **Mocks**: `jest.mock` maps to `mock.module`, `jest.fn` maps to `mock` (and the Vitest `vi.fn()`/`vi.mock()` globals also work inside `bun test` without imports, so many Vitest-style files run unmodified), `jest.spyOn` maps to `spyOn`, and `mock.restore()`/`mock.clearAllMocks()` cover teardown. Bun also gives you auto-restoring spies via `using spy = spyOn(obj, "method")` — no manual `mockRestore()` needed.
- **Snapshots**: `expect(value).toMatchSnapshot()` and `toMatchInlineSnapshot()` work as in Jest (inline snapshots are updated in-file automatically), `expect.any(...)` property matchers are supported, and `bun test --update-snapshots` refreshes stale snapshots. Bun 1.4 also fixed snapshot edge cases (counters reset properly across retries; snapshot-creation errors in CI now include the snapshot name and received value), and no test API was removed — everything Jest-compatible in Bun still applies.

To shape the actual plan, I need answers on a few things:

**About your mocks (the part you're most worried about):**
1. Which mocking patterns do you rely on most — `jest.mock` with inline factories, manual mocks in `__mocks__/` directories, `jest.spyOn` on real modules, `jest.fn` passed as props, or `jest.requireActual`?
2. Are any mocked modules ESM/CJS hybrids, or do any mocks touch side-effect-heavy imports (DB clients, env vars, native addons)? Any use of `moduleNameMapper`, path aliases, or ts-jest transforms in `jest.config.js` that the tests depend on?
3. Do you use fake timers (`jest.useFakeTimers()`, `setSystemTime`) anywhere? Bun supports those (and since 1.3.4 fakes `Date` too), but I want to know before planning.

**About your snapshots:**
4. Roughly how many snapshot files, and are they mostly object snapshots, inline snapshots, or custom serializers? How do you currently update them in CI — manual runs, a CI flag, or review-based?

**About the wider suite:**
5. Do your tests need DOM (React/Vue components, Testing Library)? That determines whether we add `happy-dom` via a preload.
6. What's the suite size and where does it run — how many test files, and does CI have constraints like "must run under X minutes" or JUnit reports? If it's large, I'd plan for Bun 1.4's `--parallel` workers, `--shard` splitting across CI machines, and `--timings`-based balancing rather than a plain serial run.
7. Preference: big-bang migration in one sweep, or incremental (Jest and Bun coexisting while you move files over)? Incremental is very doable.

Once you answer those, here's the strategy I'm proposing (subject to your approval — nothing gets written before you confirm):

- **Phase 1 — Audit**: inventory test files, mocking patterns, snapshot usage, and `jest.config.js`/`bunfig.toml` state.
- **Phase 2 — Foundation**: set up `bunfig.toml` (`[test]` preloads, timeouts, coverage), install `bun:test` dependencies, and configure the happy-dom preload if you need DOM.
- **Phase 3 — Migration**: port mocks (`jest.mock` → `mock.module`, spies → `spyOn` with `using` where scoped teardown helps), translate any Jest-specific matchers, and migrate snapshots — then run `bun test --update-snapshots` once and review the diff carefully.
- **Phase 4 — CI**: wire up the JUnit reporter and coverage; if the suite is large, enable `--parallel` and duration-balanced `--shard` with `--timings`.

So: how do your mocks and snapshots actually look today, and how does the suite run in CI? Give me those details and I'll turn this into a concrete, file-by-file plan for your sign-off.
