# Commit Changes


## Overview


Commit staged changes with a well-structured conventional commit message following project standards.


## CRITICAL: confirmation before `git commit`


- **Do not run `git commit` (or any commit) in the same turn where you first show the proposed message.**
- **Invoking `/commit` is not confirmation.** The user must explicitly approve in a **follow-up** message (e.g. `yes`, `confirm`, `commit it`).
- After approval, run `git commit` in the **next** turn only.


## Steps


Run all git commands directly (e.g. `git status`, `git diff --staged`, `git commit`). Do not prefix with `cd` or `cd <path> &&`; the shell is already in the project root, and the cd form can negate the command allowlist.


1. **Read project rules**
  - Review git commit message format requirements
  - Understand conventional commit structure
  - Verify platform-specific requirements
2. **Check git status**
  - Run `git status` to see current changes
  - Identify staged vs unstaged files
  - Check for any untracked files
3. **Review changes**
  - Run `git diff` to see detailed changes
  - Analyze the scope and impact of modifications
  - Identify the appropriate commit type
4. **Generate commit message**
  - Follow conventional commit format: `type(scope): description`
  - Use one `-m` per subject line and per body bullet; do not split one bullet across multiple `-m` flags
  - First line: brief summary (50 chars or less)
  - Body: one bullet per `-m`; aim for ≤72 characters per bullet, but keep a whole bullet on a single `-m` if wrapping would break mid-sentence
  - Use present tense
5. **Confirm and execute commit (two-turn minimum)**
  - Present the full proposed commit message (and optional `git commit` command) to the user
  - **Stop.** Ask them to reply with explicit confirmation (e.g. `yes`)
  - **Do not** run `git commit` until that follow-up message
  - After they confirm, run `git commit` with the message and verify success


## Commit Message Format


```bash
git commit -m "type(scope): brief description" \
 -m "- Detailed change 1" \
 -m "- Detailed change 2" \
 -m "- Additional context if needed"
```


## Common Types


- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks


## Example


```bash
git commit -m "feat(wallet): add send transaction validation" \
 -m "- Implement form validation for recipient address" \
 -m "- Add amount validation with balance checks" \
 -m "- Update error handling for invalid inputs"
```



