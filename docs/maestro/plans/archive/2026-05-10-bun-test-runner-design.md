---
title: "bun-test-runner skill"
created: "2026-05-10T13:13:53Z"
status: "approved"
authors: ["TechLead", "User"]
type: "design"
design_depth: "standard"
task_complexity: "medium"
---

# bun-test-runner Skill Design Document

## Problem Statement

The goal is to create a robust, highly-reliable `bun-test-runner` skill for the Gemini CLI. This skill must act as a strict testing architect for the user's project, moving away from "vibe coding" towards rigorous software engineering practices. It needs to establish, migrate, or expand testing suites using Bun's fast, Jest-compatible test runner. The skill must enforce a high confidence threshold (95%+), requiring it to proactively scan the project and extensively interview the user about the project's context before making decisions.

## Requirements

### Functional Requirements

1. **REQ-1**: The skill must scan the project directory to evaluate existing test infrastructure.
2. **REQ-2**: The skill must interview the user to clarify testing strategies and project context until 95% confident.
3. **REQ-3**: The skill must recommend a testing strategy (e.g., TDD, mocking patterns) if the user is unsure.
4. **REQ-4**: The skill must generate, migrate, or expand the test suite using Bun's test runner APIs.

### Non-Functional Requirements

1. **REQ-N1**: The skill must strictly adhere to rigorous software engineering practices (no vibe coding).
2. **REQ-N2**: The skill must utilize the documentation provided in `@tmp/bun-test-runner/docs`.

### Constraints

- The output must be a standard Gemini CLI `SKILL.md` file.

## Approach

### Selected Approach

**Interactive Architect Flow**

The skill will be implemented as a rigorous, interactive workflow that prioritizes deep context gathering before any code is generated. 

Key workflow steps:
1. **Discovery & Auditing**: The skill will first scan the project directory to evaluate existing test infrastructure or the lack thereof. — *[Rationale: The user requires the skill to decide the best path (create, migrate, or expand) based on current state.]*
2. **Interrogation**: The skill will ask the user detailed questions about the project's domain, architecture, and testing preferences, refusing to proceed until it is 95% confident. — *[Rationale: The user explicitly requested the skill not to hesitate to ask as many questions as needed to avoid "vibe coding".]*
3. **Strategy Recommendation**: Based on the audit and user answers, the skill will present testing approach options (e.g., TDD, coverage goals, mocking patterns) and explain them. — *[Rationale: The user specified the skill must guide the user through these choices, or make the decision if the user defers.]*
4. **Execution**: The skill will generate, migrate, or add tests using the provided `@tmp/bun-test-runner/docs` as the source of truth for Bun's specific APIs and syntax.

### Alternatives Considered

#### Autonomous Generation
- **Description**: The skill automatically scans the project and immediately generates tests without user interaction.
- **Pros**: Fast execution, minimal user friction.
- **Cons**: High risk of hallucinating requirements or producing superficial "vibe coding" tests.
- **Rejected Because**: The user explicitly stated this skill is for rigorous engineering and must ask clarifying questions until highly confident.

### Decision Matrix

| Criterion | Weight | Interactive Architect Flow | Autonomous Generation |
|-----------|--------|----------------------------|-----------------------|
| Rigorous Engineering | 50% | 5: Enforces high confidence | 2: Risk of superficial tests |
| Flexibility | 30% | 5: Adapts to migration/expansion | 3: Assumes standard paths |
| Speed | 20% | 2: Slower due to interrogation | 5: Immediate execution |
| **Weighted Total** | | **4.4** | **3.1** |

## Architecture

### Component Diagram

```
[User Request] -> [bun-test-runner Skill]
                        |
                        v
                 [Discovery Phase] (Scans codebase)
                        |
                        v
                 [Interrogation Phase] (Interviews user)
                        |
                        v
                 [Strategy Phase] (Recommends approach)
                        |
                        v
                 [Execution Phase] (Generates tests using @tmp/bun-test-runner/docs)
```

## Agent Team

| Phase | Agent(s) | Parallel | Deliverables |
|-------|----------|----------|--------------|
| 1     | `coder`  | No       | `skills/bun-test-runner/SKILL.md` |

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| User Fatigue | LOW | MEDIUM | Ensure the skill's questions are highly targeted and based on initial project scans to avoid redundant or trivial questions. |
| Incomplete Documentation | HIGH | LOW | The skill will strictly rely on the provided `@tmp/bun-test-runner/docs` to ensure generated tests use correct Bun APIs (e.g., `bun:test`). |
| Context Window Exhaustion | MEDIUM | MEDIUM | The interrogation phase might accumulate too much context. The skill should be instructed to summarize findings before generating the test suite. |

## Success Criteria

1. A complete `SKILL.md` is generated in `skills/bun-test-runner/`.
2. The skill instructions accurately reflect the "Interactive Architect Flow".
3. The skill instructions incorporate specific Bun testing knowledge from `@tmp/bun-test-runner/docs`.