# Commit Message Convention

Use the following format:

<type>(<scope>): <subject>

Examples:
- feat(auth): add login validation
- fix(api): handle empty response
- refactor(train): simplify loss computation
- docs(paper): revise experiment section
- test(parser): add edge case coverage
- chore(config): update gitignore
- perf(search): reduce repeated queries
- build(env): update dependency versions
- ci(actions): adjust workflow trigger
- revert(core): revert incorrect cache logic

## Allowed Types

| Type | Meaning |
|------|---------|
| feat | New feature |
| fix | Bug fix |
| refactor | Code refactoring without changing external behavior |
| docs | Documentation only |
| test | Add or update tests |
| chore | Maintenance, configuration, cleanup, minor non-feature changes |
| perf | Performance improvement |
| build | Build system, dependencies, environment, packaging |
| ci | CI/CD pipeline or automation changes |
| revert | Revert a previous commit |

## Rules

- Write commit messages in English
- Use the format `<type>(<scope>): <subject>`
- `scope` is optional but recommended when clear
- Keep the subject concise and specific
- Use imperative mood, such as `add`, `fix`, `update`, `remove`, `refactor`
- Do not end the subject with a period
- Avoid vague messages such as:
    - `update`
    - `fix bug`
    - `some changes`
    - `modify code`
- One commit should describe one main logical change

## Scope Examples

Common scopes:
- auth
- api
- core
- config
- db
- model
- train
- dataset
- script
- docs
- paper
- test
- repo

Choose the most relevant scope based on the main files changed.

## Guidance for AI

When generating a commit message:
1. Identify the main purpose of the change
2. Choose the best matching type
3. Add a scope if it is clear from the files changed
4. Write a short and specific subject
5. Follow the format strictly