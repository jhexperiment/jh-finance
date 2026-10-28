# Commit Changes

## Overview

Commit **currently staged** changes with a well-structured conventional commit message following project standards.

- **Only staged content.** Construct the message from, and run `git commit` against, the index as it already is.
- **Do not stage anything.** Do not run `git add`, `git add -A`, `git add -u`, or otherwise move unstaged or untracked files into the index.
- Unstaged and untracked files may be listed for context; they must **not** be included in the message or the commit.

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
2. **Check git status (staged only for the commit)**
   - Run `git status` to see staged vs unstaged vs untracked files
   - If **nothing is staged**, stop. Tell the user there is nothing to commit and do not invent a message or stage files
   - Note unstaged/untracked paths only to confirm they will be left out
3. **Review staged changes**
   - Run `git diff --staged` (not `git diff`) to see what will be committed
   - Analyze the scope and impact of **staged** modifications only
   - Identify the appropriate commit type from that staged diff
4. **Generate commit message**
   - Follow conventional commit format: `type(scope): description`
   - Use one `-m` per subject line and per body bullet; do not split one bullet across multiple `-m` flags
   - First line: brief summary (50 chars or less)
   - Body: one bullet per `-m`; aim for ≤72 characters per bullet, but keep a whole bullet on a single `-m` if wrapping would break mid-sentence
   - Use present tense
   - Describe only the staged diff; do not mention unstaged or untracked work
5. **Confirm and execute commit (two-turn minimum)**
   - Present the full proposed commit message (and optional `git commit` command) to the user
   - List the staged files that will be committed; mention any unstaged/untracked files that will **not** be included
   - **Stop.** Ask them to reply with explicit confirmation (e.g. `yes`)
   - **Do not** run `git commit` until that follow-up message
   - After they confirm, run `git commit` with the message (no extra `git add`) and verify success

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
