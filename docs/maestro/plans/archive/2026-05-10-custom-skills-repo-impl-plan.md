---
title: "Custom Skills Repository Implementation Plan"
design_ref: "docs/maestro/plans/2026-05-10-custom-skills-repo-design.md"
created: "2026-05-10"
status: "draft"
total_phases: 3
estimated_files: 8
task_complexity: "complex"
---

# Custom Skills Repository Implementation Plan

## Plan Overview

- **Total phases**: 3
- **Agents involved**: `devops_engineer`, `coder`, `technical_writer`
- **Estimated effort**: Moderate effort to establish the foundation, tooling, and core documentation for a healthy open-source agent skills repository.

## Dependency Graph

```text
       [1: DevOps Foundation]
               /     \
             /         \
 [2: CLI Tooling]   [3: Core Docs]
```

## Execution Strategy

| Stage | Phases | Execution | Agent Count | Notes |
|-------|--------|-----------|-------------|-------|
| 1     | 1      | Sequential| 1           | DevOps Foundation |
| 2     | 2, 3   | Parallel  | 2           | CLI and Docs can run concurrently |

## Phase 1: DevOps Foundation

### Objective
Initialize the repository with a package manager (Bun), configure local pre-commit hooks (Husky), and set up the remote CI workflow (`validate.yml`) to enforce strict governance.

### Agent: `devops_engineer`
### Parallel: false

### Files to Create

- `package.json` — Initialize Bun project, add `husky` as a dependency, and add a `validate` script.
- `.husky/pre-commit` — Bash script to run local validation before allowing a commit.
- `.github/workflows/validate.yml` — GitHub Actions workflow to run Bun installation and validation checks on PRs.
- `.gitignore` — Ensure `node_modules`, `@tmp/`, and `.husky/_` are ignored.

### Files to Modify

- None (Greenfield)

### Implementation Details

- **Package Manager**: Use `bun init` or manually create `package.json` with `bun` as the specified engine.
- **Husky**: Set up the pre-commit hook to trigger a formatting/linting script. Even a simple script that checks YAML parsing or markdown formatting is sufficient.
- **CI**: The workflow should trigger on `push` and `pull_request`, checkout the code, setup Bun (`oven-sh/setup-bun`), install dependencies, and run validation.

### Validation

- Run `bun install` to ensure `package.json` is valid.
- Verify `.github/workflows/validate.yml` exists and is well-formed.

### Dependencies

- Blocked by: None
- Blocks: [2, 3]

---

## Phase 2: Documentation Fetcher CLI

### Objective
Implement a Bun-based TypeScript CLI script (`fetch-docs.ts`) capable of fetching remote documentation and caching it locally.

### Agent: `coder`
### Parallel: true

### Files to Create

- `scripts/fetch-docs.ts` — TypeScript executable script that fetches a URL and writes its content to `@tmp/`.

### Files to Modify

- None

### Implementation Details

- **Input**: The script should accept a URL as a command-line argument.
- **Processing**: Use native `fetch` (available in Bun) to retrieve the content.
- **Output**: Write the response body to a file in the `@tmp/` directory. The filename can be derived from the URL or a timestamp.
- **Error Handling**: Gracefully handle failed requests or invalid URLs.

### Validation

- Run `bun run scripts/fetch-docs.ts https://example.com` and verify the file is created in `@tmp/`.

### Dependencies

- Blocked by: [1]
- Blocks: None

---

## Phase 3: Core Documentation & Skill Template

### Objective
Draft the foundational documentation required for an open-source skills repository, including the `AGENTS.md` routing file and a sample skill template.

### Agent: `technical_writer`
### Parallel: true

### Files to Create

- `AGENTS.md` — The root entry point for AI agents, explaining the repository layout and the `AGENTS` sector standard.
- `CODE_OF_CONDUCT.md` — A standard code of conduct for open-source contributors.
- `skills/template/SKILL.md` — A baseline skill template demonstrating the directory-based structure and the required YAML frontmatter.

### Files to Modify

- None

### Implementation Details

- **`AGENTS.md`**: Must instruct agents to look in `skills/<skill-name>/SKILL.md` and respect the progressive disclosure pattern (reading frontmatter first).
- **Template**: The `SKILL.md` template must include `name` and `description` in its YAML frontmatter.

### Validation

- Verify the `AGENTS.md` file exists and clearly maps the structure.
- Verify `skills/template/SKILL.md` contains valid YAML frontmatter.

### Dependencies

- Blocked by: [1]
- Blocks: None

---

## File Inventory

| # | File | Phase | Purpose |
|---|------|-------|---------|
| 1 | `package.json` | 1 | Bun project definition and scripts |
| 2 | `.husky/pre-commit` | 1 | Local commit validation hook |
| 3 | `.github/workflows/validate.yml` | 1 | Remote CI validation workflow |
| 4 | `.gitignore` | 1 | Ignore temporary and dependency files |
| 5 | `scripts/fetch-docs.ts` | 2 | CLI tool to fetch documentation |
| 6 | `AGENTS.md` | 3 | Agent routing and repository map |
| 7 | `CODE_OF_CONDUCT.md` | 3 | Community guidelines |
| 8 | `skills/template/SKILL.md` | 3 | Standard skill template |

## Risk Classification

| Phase | Risk | Rationale |
|-------|------|-----------|
| 1     | MEDIUM | Critical foundation. If Husky or GitHub Actions are misconfigured, it blocks the entire governance model. |
| 2     | LOW | Standalone script, easily isolated and tested. |
| 3     | LOW | Purely documentation; no execution risk. |

## Execution Profile

```text
Execution Profile:
- Total phases: 3
- Parallelizable phases: 2 (in 1 batch)
- Sequential-only phases: 1
- Estimated parallel wall time: ~4 minutes
- Estimated sequential wall time: ~6 minutes

Note: Native subagents currently run without user approval gates.
All tool calls are auto-approved without user confirmation.
```
