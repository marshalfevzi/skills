---
title: "Release Automation Implementation"
created: "2026-05-10"
status: "draft"
authors: ["TechLead", "User"]
type: "design"
design_depth: "quick"
task_complexity: "medium"
---

# Release Automation Design Document

## Problem Statement
The skills repository needs an automated, predictable versioning system and changelog generator. To maintain the "Strict" governance model, commit messages must be structured in a machine-readable format so that releases can be fully automated.

## Requirements

### Functional Requirements
1. **REQ-1 (Commit Enforcement)**: Contributors must write commit messages following the Conventional Commits specification.
2. **REQ-2 (Automated Bumps)**: The repository must have a command to automatically bump the version based on commit history.
3. **REQ-3 (Changelog)**: `CHANGELOG.md` must be generated automatically from commit subjects.
4. **REQ-4 (Release Action)**: Pushing a version tag must trigger a GitHub Release.

## Approach

**Selected Approach: `commitlint` + `standard-version`**
We will install `@commitlint/cli` and hook it into Husky to block invalid commit messages locally. We will use `standard-version` as the release orchestrator, configured via `.versionrc.js` to categorize agent skill additions. A GitHub Action will watch for new tags and publish releases.

## Agent Team

| Phase | Agent(s) | Parallel | Deliverables |
|-------|----------|----------|--------------|
| 1     | `devops_engineer` | No | Install commitlint, configure Husky `commit-msg`, and setup `.versionrc.js`. |
| 2     | `devops_engineer` | No | Create the `.github/workflows/release.yml` GitHub Action. |

## Success Criteria
1. Committing `wip: fixed stuff` is rejected by Husky.
2. Committing `fix: resolve issue` is accepted.
3. Running `bun run release` updates `CHANGELOG.md` and `package.json`.