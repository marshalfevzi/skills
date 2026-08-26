Nice — a fresh TypeScript API on Bun is a great starting point, and the token-expiration logic is exactly the kind of thing a test suite should pin down early. Time-dependent code is where "works on my machine, expires at 3am in prod" bugs live, so I'm glad it's on the table from day one.

Since this is a new project there's no existing suite or config to audit — no `*.test.ts` files, no Jest/Vitest/Mocha baggage, no `bunfig.toml` yet. That means we get to architect from a clean slate and take full advantage of Bun's built-in runner (`bun:test`) with zero extra dependencies. Before I lay out a strategy, I need to interrogate a few things so I'm at ~95% confidence on the requirements:

1. **Primary goal** — is this TDD for the new features as the API takes shape, or a coverage baseline once the core is written?
2. **Critical paths** — token expiration is clearly one. What else is load-bearing: auth flows, rate limiting, DB access, webhook handling? What failure mode are you most worried about?
3. **External dependencies** — does the API hit a real Postgres/Redis, third-party APIs, or the file system? Which should be mocked vs. integration-tested against the real thing?
4. **Time-sensitive specifics** — how do tokens validate today: comparing timestamps against `Date.now()`, JWT `exp` claims, or scheduled cleanup (e.g. `Bun.cron`)? That determines whether we drive the clock with `setSystemTime()`/fake timers or assert against fixed fixtures.
5. **DOM/UI testing** — none needed for a pure API, presumably — confirm?
6. **Performance/CI constraints** — any hard budget ("full suite < 30s") or CI reporter needs (JUnit XML, coverage thresholds)?
7. **Concurrency preference** — `test.concurrent` for speed, or sequential to keep it dead simple?
8. **Suite scale / where it runs** — how large will this grow and where does it run? If CI is involved, I'd plan `--parallel` worker processes, `--shard` splitting across machines, and `--timings`-based balancing (Bun 1.4) — but for a small suite, serial `bun test` with one shared module registry is often faster.

Here's the strategy I'd propose, pending your answers:

**Greenfield TDD suite, time-sensitivity first.** A `bun:test` suite with the token-expiration logic as the first deep target: `setSystemTime()` to pin the clock, fake timers for any timeout/expiry-scan paths (Bun fakes `Date` too, and `jest.setSystemTime()` composes with `jest.advanceTimersByTime()`), and a `bunfig.toml` `[test]` block (timeout, coverage, preload for env) set up from the start. External dependencies get mocked at the module boundary with `mock.module` so token tests stay hermetic; anything touching a real DB goes in a separate integration group. I'll use `test.failing` for any known-unfixed expiry edge case so it's tracked without breaking CI.

For the time-sensitive core specifically, the tests I'd pin down first: expired tokens rejected at the exact boundary (`exp` vs. `exp - 1ms`), near-expiry refresh windows, the "never expires" case, and clock-skew handling — all deterministic, no `sleep()` calls, running in milliseconds.

Two quick questions before anything is written: (a) does the project have `package.json`/`bunfig.toml` scaffolding yet, or should the first step be creating that alongside the test setup? (b) any preference on test location — `src/**/*.test.ts` next to the code, or a separate `tests/` directory?

Once you confirm the plan — and only then — I'll implement it. No test code written yet, per the flow.
