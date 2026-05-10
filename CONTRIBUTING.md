# Contributing to Skills

Thank you for your interest in contributing to the Skills repository! We welcome new skills that help agents perform tasks more effectively.

## Adding a New Skill

To add a new skill, follow these steps:

1.  **Gather Documentation (Optional)**: Use the interactive creator to fetch documentation for the tool or service you are building a skill for:
    ```bash
    bun run new
    ```
    This will save documentation to `@tmp/<skill-name>/` for your reference.

2.  **Create a Skill Directory**: Create a new directory under `skills/` using a kebab-case name (e.g., `skills/my-new-skill/`).
3.  **Use the Template**: Copy `skills/template/SKILL.md` to your new directory.
3.  **Populate Metadata**: Fill in the YAML frontmatter in `SKILL.md`:
    - `name`: A unique identifier for the skill.
    - `description`: A clear, concise description of what the skill does (used for discovery).
    - `version`: Semantic versioning (e.g., `1.0.0`).
    - `category`: A relevant category for the skill.
4.  **Write Instructions**: Complete the sections in `SKILL.md` (Overview, Usage, Methodology, etc.).
5.  **Add Assets (Optional)**: If your skill requires scripts, templates, or reference data, place them within your skill's directory.

## Directory Structure Requirements

Each skill must be self-contained:

```
skills/
└── <skill-name>/
    ├── SKILL.md          # Required: metadata + instructions
    ├── scripts/          # Optional: executable code
    ├── references/       # Optional: documentation
    └── assets/           # Optional: templates, resources
```

## Progressive Disclosure Pattern

All skills must be designed to support the **Progressive Disclosure** pattern. This means:
- The `description` in the frontmatter must be sufficient for an agent to decide if the skill is relevant.
- The `SKILL.md` should be the primary entry point.
- Large assets or detailed documentation should be referenced from `SKILL.md` rather than included directly if they are not always needed.

## Quality Guidelines

- **Clarity**: Instructions should be clear and unambiguous for an AI agent.
- **Portability**: Avoid hardcoding paths that are specific to your local environment.
- **Safety**: Ensure that any scripts or instructions follow security best practices.

## Validation

Before submitting a pull request, ensure your changes pass the validation checks:

```bash
bun run validate
```

## Submission Process

1.  Fork the repository.
2.  Create a new branch for your skill.
3.  Commit your changes.
4.  Submit a pull request with a clear description of the new skill.
