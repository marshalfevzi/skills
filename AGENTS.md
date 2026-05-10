# Agent Guide: Skills Repository

Welcome, Agent. This repository is a structured collection of "Skills" designed for AI consumption and execution.

## Repository Identity
This repository serves as a decentralized library of capabilities. Each skill is self-contained within its own directory under the `skills/` root.

## Structure
Skills follow a strict directory-based structure:
`skills/<skill-name>/SKILL.md`

- `<skill-name>`: A kebab-case unique identifier for the skill.
- `SKILL.md`: The primary entry point containing metadata and instructions.

## Interaction Protocol: Progressive Disclosure
To minimize context usage and maximize efficiency, you MUST follow the **Progressive Disclosure** pattern when exploring this repository:

1. **Discovery**: List the `skills/` directory to see available capabilities.
2. **Metadata Check**: Read only the YAML frontmatter of a `SKILL.md` file to determine if it matches your current task requirements.
3. **Full Load**: Only if the metadata confirms relevance, read the entire `SKILL.md` and any associated assets in that skill's directory.

## Contributing
When adding new skills, use the `skills/template/SKILL.md` as a baseline. Ensure all frontmatter fields are populated accurately.
