# UFCL Mobile — Git Branching Guide

This repository now uses a structured branching strategy based on Git Flow.
All future development must follow these rules.

---

## Branch Map

```
main (master)       ──── stable production code only ────────────────────────►
                    │                    │                          │
                    │ hotfix/v1.0.1      │                          │
                    ◄────────────────────┤                          │
                                         │                          │
develop             ──── integration ────┼──────────────────────────┼─────────►
                    │                    │                          │
                    │ feature/push-notif │ feature/stock-transfers  │
                    ◄────────────────────┤                          │
                                         ▼                          │
                             release/v1.1.0 ─── UAT ───────────────►
```

---

## Branch Definitions

### `master` (production)

- **Contains:** Signed, released code only.
- **Protected:** Never commit directly. Only accept merges from `release/*` or `hotfix/*`.
- **Tagging:** Every merge to master gets a version tag (`v1.0.0`, `v1.0.1`, `v1.1.0`).
- **CI:** GitHub Actions runs on every push — builds a signed APK and deploys to server.

### `develop` (integration)

- **Contains:** All completed features that are ready for the next release.
- **Source of truth** for v1.1 work.
- **Rule:** Only tested, reviewed feature branches may be merged here.
- **CI:** Optional — can run a debug build to validate nothing breaks.

### `feature/*` (new work)

- **Naming:** `feature/<short-description>` — e.g. `feature/push-notifications`, `feature/stock-transfers`
- **Branch from:** `develop`
- **Merge to:** `develop` (via pull request, after testing)
- **Lifetime:** Deleted after merge

### `release/*` (release candidate)

- **Naming:** `release/v1.1.0`
- **Branch from:** `develop` (when all v1.1 features are merged)
- **Purpose:** Bug fixes only during UAT — no new features
- **Merge to:** `master` AND back to `develop`
- **Lifetime:** Deleted after the version is tagged and released

### `hotfix/*` (emergency production fix)

- **Naming:** `hotfix/v1.0.1-<description>` — e.g. `hotfix/v1.0.1-login-crash`
- **Branch from:** `master` (at the last release tag)
- **Merge to:** `master` AND `develop` (to keep both branches in sync)
- **Lifetime:** Deleted after merge and tag

---

## Workflows

### Fix a production bug (hotfix)

```bash
# 1. Branch from master at the release tag
git checkout master
git pull origin master
git checkout -b hotfix/v1.0.1-describe-the-bug

# 2. Fix the bug
# ... edit files ...
git add <files>
git commit -m "Fix: describe the bug

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# 3. Merge to master
git checkout master
git merge --no-ff hotfix/v1.0.1-describe-the-bug
git tag -a v1.0.1 -m "v1.0.1: fix describe-the-bug"
git push origin master
git push origin v1.0.1

# 4. Merge to develop (keep it in sync)
git checkout develop
git merge --no-ff hotfix/v1.0.1-describe-the-bug
git push origin develop

# 5. Delete the hotfix branch
git branch -d hotfix/v1.0.1-describe-the-bug
git push origin --delete hotfix/v1.0.1-describe-the-bug
```

### Develop a new feature (feature branch)

```bash
# 1. Branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/push-notifications

# 2. Develop and test
# ... edit files ...
git add <files>
git commit -m "Add push notification infrastructure"

# Repeat for each logical chunk of work

# 3. When feature is complete and tested:
git checkout develop
git merge --no-ff feature/push-notifications
git push origin develop

# 4. Delete the feature branch
git branch -d feature/push-notifications
git push origin --delete feature/push-notifications
```

### Create a release (v1.1.0)

```bash
# 1. Branch from develop when all v1.1 features are merged
git checkout develop
git pull origin develop
git checkout -b release/v1.1.0

# 2. Bump version number
# Edit mobile/package.json: "version": "1.1.0"
git add mobile/package.json
git commit -m "Bump version to 1.1.0"

# 3. Run UAT on this branch (fix bugs here, no new features)
git add <bugfix files>
git commit -m "Fix: issue found during UAT"

# 4. When UAT passes, merge to master
git checkout master
git merge --no-ff release/v1.1.0
git tag -a v1.1.0 -m "v1.1.0: description of release"
git push origin master
git push origin v1.1.0

# 5. Merge back to develop to keep in sync
git checkout develop
git merge --no-ff release/v1.1.0
git push origin develop

# 6. Delete release branch
git branch -d release/v1.1.0
git push origin --delete release/v1.1.0
```

---

## Pull Request Rules

All merges into `develop` and `master` go through a Pull Request:

1. Open PR on GitHub
2. Title: `[type] Short description` — e.g. `[feature] Add push notifications`
3. Description must include: what changed, how to test, any migration steps
4. Require at least one reviewer (IT lead or senior developer)
5. CI must pass (GitHub Actions green)
6. Squash or merge commit — not rebase (preserves history)

---

## Commit Message Format

```
Type: Short description (50 chars max)

Optional longer explanation. What changed and why.
Include migration steps if schema changed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `Fix`, `Add`, `Update`, `Remove`, `Docs`, `Refactor`, `Test`, `Chore`

---

## Current State

```
master          → v1.0.0 (604926d) — production
develop         → v1.0.0 (604926d) — ready for v1.1 work
```

---

## Quick Reference

| I want to... | Branch from | Merge to |
|---|---|---|
| Fix a production crash | `master` | `master` + `develop` |
| Fix a pilot bug | `master` | `master` + `develop` |
| Build a new feature | `develop` | `develop` |
| Stabilize a release | `develop` | `master` + `develop` |

---

*Branching strategy set up: 2026-06-29, on v1.0.0 release.*
