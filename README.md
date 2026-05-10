# Skills Repository

A decentralized library of capabilities ("Skills") designed for AI consumption and execution. This repository follows the [Agent Skills](https://github.com/agentskills/agentskills) open standard.

## Overview

Agent Skills are a lightweight, open format for extending AI agent capabilities with specialized knowledge and workflows. Each skill is a self-contained directory containing a `SKILL.md` file with metadata and instructions.

This repository serves as a central hub for these capabilities, allowing agents to discover and activate them as needed.

## AGENTS Standard

This repository adheres to the interaction protocol defined in [AGENTS.md](./AGENTS.md). Agents interacting with this repository MUST follow the **Progressive Disclosure** pattern:

1. **Discovery**: List the `skills/` directory.
2. **Metadata Check**: Read the YAML frontmatter of `SKILL.md`.
3. **Full Load**: Read the entire `SKILL.md` only if relevant.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime installed.

### Installation

```bash
bun install
```

## CLI Usage

### Creating a New Skill

The repository provides an interactive creator to help you gather documentation for a new skill.

```bash
bun run new
```

This command will:
1. Prompt for a skill name.
2. Prompt for one or more URLs to fetch documentation from.
3. Support recursive fetching from GitHub folders (e.g., `https://github.com/owner/repo/tree/main/docs`).
4. Support direct downloads for raw files (`.md`, `.mdx`, `.txt`).
5. Automatically use [markdown.new](https://markdown.new) as a fallback for standard web pages to extract clean markdown content.

All fetched documentation is saved to `@tmp/<skill-name>/` for you to use when drafting your `SKILL.md`.

## Repository Structure

- `skills/`: Root directory for all skills.
  - `<skill-name>/SKILL.md`: The primary entry point for a skill.
  - `template/`: Template for creating new skills.
- `scripts/`: Utility scripts for repository maintenance and skill development.

## Governance

- **Validation**: CI runs `bun run validate` on every push and pull request to ensure repository integrity.
- **Pre-commit Hooks**: [Husky](https://typicode.github.io/husky/) is used to run local checks before commits.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to add new skills to this repository.

## License

This project is licensed under the terms of the [LICENSE](./LICENSE) file.
