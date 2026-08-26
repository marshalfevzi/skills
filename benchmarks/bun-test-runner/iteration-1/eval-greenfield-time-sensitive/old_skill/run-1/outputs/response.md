Got it — a greenfield TypeScript API on Bun with time-sensitive token-expiration logic. Since this is a brand-new project, there's no existing test surface to audit yet (no `*.test.ts` files, no `package.json` framework config, no `bunfig.toml`), so we skip straight to nailing down the requirements before I propose a strategy. I won't write or modify any test code until you've approved the plan.

A few questions to get to 95% confidence:

1. **Primary goal**: Are we starting test-first (TDD) from the very beginning, or do you want the suite architected alongside the API as it's built?
2. **Critical paths**: Beyond token expiration, what are the must-test critical paths — auth middleware, refresh-token rotation, user/endpoint handlers, DB access?
3. **External dependencies**: What does the API talk to — a real database (Postgres/SQLite), a third-party auth provider, the filesystem? What needs mocking (`mock.module`, spies) versus real integration?
4. **Token-expiration specifics**: What's the expiry model — JWT with `exp` claims, an in-memory session store, or a DB-backed token table? And do the tests need to simulate time passing (e.g., advancing a fake clock past the expiry moment), or just boundary checks at fixed timestamps?
5. **Time-sensitive strategy preference**: Bun's runner gives us `setSystemTime()` plus `jest.useFakeTimers()` / `jest.setSystemTime()` for deterministic clock control — I'd lean on those for the expiry cases. One caveat from Bun's current behavior: the `Date` constructor does *not* change when timers are faked (unlike Jest), so if your expiry logic reads `new Date()`, we may need to route it through the faked clock. Any constraints on how the logic reads the current time?
6. **DOM/UI**: This sounds like a pure API — confirming there's no front-end surface, so we skip `happy-dom` setup.
7. **CI/CD constraints**: Any timing budget ("must run in < N seconds") or JUnit reports needed for CI dashboards?
8. **Concurrency**: Prefer `test.concurrent` by default, or sequential execution? With shared DB/state, sequential may be safer initially, then we can parallelize once isolation is proven.

Once you answer, here's the direction I'm leaning (pending your approval): a TDD suite for the API, using `bun:test` spies to mock external dependencies, `setSystemTime`/fake timers to drive the token-expiration scenarios (expired, about-to-expire, refresh window, clock advanced past expiry), and per-test cleanup via `onTestFinished`/`afterEach` so nothing leaks between tests. I'd also wire up `bunfig.toml` with the test configuration we agree on (root, timeout, env file).

Does that plan sound right? Any adjustments before I start implementing?
