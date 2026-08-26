# Skills with receipts

Focused Agent Skills for specialized work — and benchmark evidence you can inspect.

[![CI](https://img.shields.io/github/actions/workflow/status/marshalfevzi/skills/validate.yml?branch=main&label=CI&style=flat-square)](https://github.com/marshalfevzi/skills/actions/workflows/validate.yml)
[![Repo version](https://img.shields.io/github/package-json/v/marshalfevzi/skills?style=flat-square&label=repo)](https://github.com/marshalfevzi/skills/releases)
[![License](https://img.shields.io/github/license/marshalfevzi/skills?style=flat-square)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-000000?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)

## What this is

Each `skills/<name>/` directory is a self-contained Agent Skill: its `SKILL.md` is discovered first, and its references/assets are loaded only when relevant. Skills follow the [Agent Skills standard](https://agentskills.io); this repository's interaction protocol lives in [AGENTS.md](AGENTS.md).

## Quick start

```bash
git clone https://github.com/marshalfevzi/skills.git
cd skills
bun install
bun run validate
bun run new
```

`bun run new` starts the interactive documentation fetcher. Fetched source material lands in `@tmp/<skill-name>/`, and the resulting skill is created under `skills/<name>/` with `SKILL.md` as its entrypoint.

## Skills

| Skill | Focus | Skill content version | Last updated | Tested target | Evidence |
|---|---|---|---|---|---|
| [incus-lxc](skills/incus-lxc/SKILL.md) | Operate Incus/LXC instances, images, profiles, storage, networks, projects, snapshots, and safety gates. | 1.0.0 | 2026-08-26 | Incus 6.0.0 (current fixture) | [iteration 1](benchmarks/incus-lxc/iteration-1/benchmark.md) |
| [bun-test-runner](skills/bun-test-runner/SKILL.md) | Bun's built-in test runner: Jest-compatible suites, mocking, snapshots, DOM (happy-dom), type testing, and Bun 1.4 CI scaling (`--parallel`, `--shard`, `--timings`). | 1.0.0 | 2026-08-26 | Bun 1.4.0 | [iteration 1](benchmarks/bun-test-runner/iteration-1/benchmark.md) |

`1.0.0` is the `version` in each skill's `SKILL.md`; the repository package is separately versioned at `0.1.0`. The Incus version is the version used by the committed fixture, not a compatibility ceiling. `template` is scaffolding and is not presented as a maintained skill.

## Benchmarks

Eval case definitions live beside the skill at [skills/incus-lxc/evals/evals.json](skills/incus-lxc/evals/evals.json); committed run evidence lives under [benchmarks/incus-lxc/iteration-1](benchmarks/incus-lxc/iteration-1/).

| Configuration | Pass rate | Mean wall time | Range |
|---|---|---|---|
| With skill | 100% (12/12 assertions) | 299.7 ± 89.8 s | 220–397 s |
| Without skill | 100% (12/12 assertions) | 349.7 ± 124.4 s | 247–488 s |
| Difference | — | −50.0 s (−14%) | — |

This iteration runs three scenarios once with and once without the skill, so the pass rate does not distinguish the configurations; the observed signal is lower mean wall time and fewer avoidable validation errors in the with-skill runs. The recorded zero token values are not a quality metric.

Read the human report ([benchmark.md](benchmarks/incus-lxc/iteration-1/benchmark.md)), the machine-readable summary ([benchmark.json](benchmarks/incus-lxc/iteration-1/benchmark.json)), the test fixture ([fixture.md](benchmarks/incus-lxc/iteration-1/fixture.md)), or any scenario directory: [eval-deploy-web-with-profile](benchmarks/incus-lxc/iteration-1/eval-deploy-web-with-profile/), [eval-dedicated-storage-pool](benchmarks/incus-lxc/iteration-1/eval-dedicated-storage-pool/), [eval-isolated-project-network](benchmarks/incus-lxc/iteration-1/eval-isolated-project-network/). Treat this as one iteration's snapshot, not a general performance guarantee.

### bun-test-runner

Eval case definitions live beside the skill at [skills/bun-test-runner/evals/evals.json](skills/bun-test-runner/evals/evals.json); committed run evidence lives under [benchmarks/bun-test-runner/iteration-1](benchmarks/bun-test-runner/iteration-1/).

| Configuration | Pass rate | Mean wall time | Range |
|---|---|---|---|
| With skill | 94% (15/16 assertions) | 35.0 ± 2.9 s | 32.7–39.1 s |
| Old skill (pre-1.4 snapshot) | 69% (11/16 assertions) | 38.1 ± 17.9 s | 22.0–63.0 s |
| Difference | +25 pp | −3.1 s | — |

First-turn behavior evals for the Bun 1.4 update. Eval 4 ([eval-ci-scaling-parallel](benchmarks/bun-test-runner/iteration-1/eval-ci-scaling-parallel/)) discriminates: with-skill runs pass all three Bun 1.4 assertions (`--parallel`, `--shard`/`--timings`, `BUN_TEST_WORKER_ID`); the pre-update snapshot fails all three. Evals 1–3 confirm the interrogation flow is unchanged. Read the human report ([benchmark.md](benchmarks/bun-test-runner/iteration-1/benchmark.md)), the machine-readable summary ([benchmark.json](benchmarks/bun-test-runner/iteration-1/benchmark.json)), the test fixture ([fixture.md](benchmarks/bun-test-runner/iteration-1/fixture.md)), or any scenario directory: [eval-greenfield-time-sensitive](benchmarks/bun-test-runner/iteration-1/eval-greenfield-time-sensitive/), [eval-jest-migration](benchmarks/bun-test-runner/iteration-1/eval-jest-migration/), [eval-react-coverage](benchmarks/bun-test-runner/iteration-1/eval-react-coverage/). One run per configuration this iteration, so the spread reflects the eval mix, not repeatability.

## Development

### Add or update a skill

Run `bun run new` when external documentation should be fetched. Create a kebab-case `skills/<name>/` from `skills/template/SKILL.md`; fill in `name`, `description`, `version`, and `category`. Keep long material in `references/` or `assets/`, and make the frontmatter description sufficient for discovery. Run `bun run validate` before committing.

### Add an eval

Keep case definitions beside the skill in `skills/<name>/evals/`, and commit each run under `benchmarks/<name>/<iteration>/` with a human summary, a machine-readable summary, a fixture, feedback, and per-scenario `with_skill`/`without_skill` artifacts. When editing a skill, update its table row's content version, last-updated date, tested target, and evidence link. Do not put locally cloned repositories under `benchmarks/`; `tmp/` is for ignored local clones.

### Release

Run `bun run release` (`standard-version`); pushing a `v*` tag drives the draft GitHub Release workflow. Keep the repository package version distinct from each skill's content version.

## Repository map

```
skills/incus-lxc/
├── SKILL.md
├── references/
└── evals/
benchmarks/incus-lxc/iteration-1/
├── benchmark.md
├── benchmark.json
├── fixture.md
├── eval-deploy-web-with-profile/
├── eval-dedicated-storage-pool/
└── eval-isolated-project-network/

benchmarks/bun-test-runner/iteration-1/
├── benchmark.md
├── benchmark.json
├── fixture.md
├── eval-greenfield-time-sensitive/
├── eval-jest-migration/
├── eval-react-coverage/
└── eval-ci-scaling-parallel/
scripts/
CONTRIBUTING.md
LICENSE
```

The root README is the index; per-iteration detail lives under `benchmarks/`.

## Sources & thanks

- [Agent Skills specification](https://github.com/agentskills/agentskills) — the skill format this repository follows.
- [Anthropic's skills examples](https://github.com/anthropics/skills) — skill structure and phrasing reference.
- [Incus documentation](https://linuxcontainers.org/incus/docs/main/) — source material for the incus-lxc skill.
- [Linux Containers image server](https://images.linuxcontainers.org) — fixture images used by the benchmark.
- [awesome-readme](https://github.com/matiassingers/awesome-readme) — README design reference.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for the community standards.

## License

Licensed under the terms of the [LICENSE](LICENSE) file.

Last reviewed: 2026-08-26
