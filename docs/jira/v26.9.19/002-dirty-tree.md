# pcp: commit or clean uncommitted changes

- Standing: OPEN
- Created: 2026-09-19 (v26.9.19 gh survey wave)
- Source: working tree dirty at survey time
- Evidence: `git status --porcelain` → 360 path(s) (tracked-modified: 288, untracked: 72); sample:  M eslint.config.js; M jest.config.js; M package-lock.json;?? Justfile;?? ORIGINAL_REQUEST.md;

## Work to complete
- Review the 288 tracked-modified path(s); commit them as atomic pieces on a purpose branch, or revert what is transient.
- For the 72 untracked path(s): add intentional files to git and commit; gitignore or delete build artifacts/temp files.
- Note: this survey's ticket files under docs/jira/v26.9.19/ are intentionally uncommitted; include or exclude them deliberately in the commit plan.

## Acceptance
- `git status --porcelain` is clean (except items deliberately deferred and recorded here).

## History
- 2026-09-19 | OPEN | survey found dirty tree | 360 paths (T288/U72) | commit/clean pending
