---
title: "Custom Skills Repository"
created: "2026-05-10"
status: "draft"
authors: ["TechLead", "User"]
type: "design"
design_depth: "deep"
task_complexity: "complex"
---

# Custom Skills Repository Design Document

## Problem Statement

While coding agents (like Claude Code and Gemini CLI) are becoming standard, finding the right specialized skills for niche tasks remains difficult. The goal is to build a personal, yet open-source, custom skills repository that adheres to the emerging 'AGENTS' sector standard. Because the repository will be public, it must implement strict automated quality gates to prevent low-effort contributions from degrading the repository's health. Additionally, it requires a purpose-built CLI tool to fetch and cache documentation to aid in skill creation.

## Requirements

### Functional Requirements

1. **REQ-1 (Skill Architecture)**: The repository must structure skills in a directory-based schema (e.g., `skills/<skill-name>/SKILL.md`) to allow for supplementary assets.
2. **REQ-2 (Skill Standard)**: Each skill must adhere to the AGENTS standard, requiring valid YAML frontmatter for discovery and progressive disclosure.
3. **REQ-3 (Documentation Fetcher)**: A CLI tool must fetch external documentation and save it to a local `@tmp/` directory for agent reference during skill creation.
4. **REQ-4 (Entry Point)**: The repository must include an `AGENTS.md` root file to map the repository for visiting AI agents.

### Non-Functional Requirements

1. **REQ-5 (Governance Strictness)**: The repository must aggressively reject malformed PRs using GitHub Actions (CI) and local pre-commit hooks.
2. **REQ-6 (CLI Performance)**: The documentation fetcher must be executed via the Bun runtime for speed and native TypeScript support.

### Constraints

- **CON-1**: Skills must be designed for installation in the standard `~/.agents/skills/` directory.

## Approach

### Selected Approach

**Strict Directory-Based Architecture with Bun Tooling**

We will implement a modular, directory-based skill repository where each skill resides in its own folder. Governance will be enforced locally via Husky (pre-commit hooks) and remotely via GitHub Actions to validate markdown and YAML schemas. The auxiliary CLI tool will be built in TypeScript and executed via Bun to fetch and cache remote documentation.

*Rationale: This represents a long-term investment. While it requires contributors to install Bun and Husky, it prevents technical debt and ensures the repository scales cleanly as complex skills (with scripts and examples) are added.* (Traces To: REQ-1, REQ-5, REQ-6)

### Alternatives Considered

#### Single-File Schema with Bash Tooling

- **Description**: Skills are flat markdown files; the CLI is a bash curl script; governance is purely CI-based.
- **Pros**: Zero local dependencies for contributors; fastest setup.
- **Cons**: Cannot easily bundle auxiliary scripts with skills; CI feedback loops are slow for contributors.
- **Rejected Because**: It fails to support complex skills that need local assets and allows sloppy commits to reach the PR stage, violating our strict governance requirement.

### Decision Matrix

| Criterion | Weight | Strict Directory-Based + Bun + Husky | Single-File + Bash + CI Only |
|-----------|--------|--------------------------------------|------------------------------|
| **Extensibility** (REQ-1) | 40% | **5**: Folders support infinite assets | **2**: Flat files limit complexity |
| **Tooling Speed** (REQ-6) | 30% | **5**: Bun is natively fast for TS | **3**: Bash is fast but hard to scale |
| **Gate Strictness** (REQ-5) | 30% | **5**: Local hooks prevent bad commits | **2**: CI-only allows messy git history |
| **Weighted Total** | | **5.0** | **2.3** |

## Architecture

### Component Diagram

```text
custom-skills-repo/
├── AGENTS.md                  # Root routing for agents
├── .github/
│   ├── CODE_OF_CONDUCT.md     
│   └── workflows/
│       └── validate.yml       # Remote CI gate
├── .husky/                    # Local pre-commit hooks
├── @tmp/                      # Git-ignored cache for fetched docs
├── scripts/
│   └── fetch-docs.ts          # Bun CLI documentation fetcher
└── skills/
    └── <skill-name>/
        ├── SKILL.md           # Core instruction payload
        └── resources/         # Optional auxiliary files
```

### Key Interfaces

```yaml
---
name: "skill-name"
description: "Brief summary for agent discovery"
---
```

**Directory Routing** — *The repository uses a nested `skills/<name>/` topology rather than a flat list to encapsulate auxiliary assets natively.* (considered: flat `/skills` directory — rejected because it clutters the root when scripts are added). Traces To: REQ-1

**Local Cache Directory** — *The documentation fetcher writes to `@tmp/`, which will be added to `.gitignore`. This prevents transient scraped data from entering version control.* (considered: writing directly to `/docs` — rejected because fetched remote docs shouldn't pollute the repo history). Traces To: REQ-3

**Dual-Gate Validation** — *Validation occurs via `.husky/pre-commit` (running local lint/format) AND `.github/workflows/validate.yml` (running isolated checks). This guarantees clean history while providing a server-side fallback.* (considered: CI-only validation — rejected because it allows sloppy commits into the PR queue). Traces To: REQ-5

## Agent Team

| Phase | Agent(s) | Parallel | Deliverables |
|-------|----------|----------|--------------|
| 1     | `devops_engineer` | No       | Initialize Node/Bun project, configure Husky pre-commit hooks, and create `.github/workflows/validate.yml`. |
| 2     | `coder`  | Yes      | Implement the `scripts/fetch-docs.ts` Bun CLI script and configure the `@tmp/` directory logic. |
| 3     | `technical_writer` | Yes      | Draft the `AGENTS.md` root file, `CODE_OF_CONDUCT.md`, and a standard `skills/template/SKILL.md`. |

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **Contributor Friction** | MEDIUM | HIGH | Strict Husky hooks may frustrate new contributors. *Mitigation: Provide a clear `CONTRIBUTING.md` (or detailed README) that explicitly instructs users to run `bun install` before committing.* |
| **Runtime Fragmentation** | LOW | MEDIUM | Contributors attempting to run the CLI with `node` instead of `bun` will face errors. *Mitigation: Add engine enforcement in `package.json` and document the Bun requirement prominently.* |
| **Agent Misrouting** | MEDIUM | LOW | Agents might fail to understand the repository structure if `AGENTS.md` is unclear. *Mitigation: We will strictly base `AGENTS.md` on the proven patterns from the inspirational repositories.* |

## Success Criteria

1. **Structural Compliance**: A sample skill (`skills/template/SKILL.md`) is successfully created containing valid YAML frontmatter, matching the AGENTS sector standard.
2. **Tooling Operability**: The `scripts/fetch-docs.ts` script successfully executes via Bun and writes output to the `@tmp/` folder.
3. **Governance Enforcement**: A GitHub Actions workflow (`validate.yml`) is successfully generated, and local Husky pre-commit hooks are configured to validate future commits.
4. **Agent Navigation**: The `AGENTS.md` file is present in the root, clearly mapping the repository directory structure for visiting LLMs.
