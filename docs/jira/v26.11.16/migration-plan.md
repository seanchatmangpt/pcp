# pcp migration plan v26.11.16

Standing: UNVERIFIED

## Identity
- Path: /Users/sac/pcp (also reachable as /Users/sac/zoeapp/pcp_symlink -> /Users/sac/pcp)
- Remote: https://github.com/seanchatmangpt/pcp.git (origin/main)
- Branch: main@7731fea; last commit 2026-07-06; commits: 7; size: 23 MB
- Languages/build: TypeScript/React (package.json, package-lock.json, jest, babel, eslint),
  Justfile. No CLAUDE.md.
- Nested repos: none

## Observed state
- Dirty: 288 modified — eslint/jest configs, package(-lock).json, and a large sweep under
  src/framework/2030/* (adversarial, agent-native, genex, i18n-semantic, identity, ...)
- Untracked: 917 — apps/template-app (30 top entries), src/framework (23), src/lib,
  src/{types,test,route-law,ontology}, verify_simulator.js; plus patch_*.js, fix_lint.js,
  ts_errors.txt scratch at root
- Ahead 1 / behind 0. Stash 0. Unpushed branches 0. No node_modules/. Submodules: none.

## What it is
"pcp" — a process/framework "2030" TypeScript codebase (process-mining, Petri-net model,
OCEL2 logger, web export with wasm4pm) that zoeapp consumes via symlink. No README; purpose
inferred from commit messages and src/framework/2030 layout.

## Classification
WARM (census agrees: last commit July 2026 but very large uncommitted surface).

## Migration risk
- 288 modified + 917 untracked files = the majority of the codebase is uncommitted, only 7
  commits exist. 1 unpushed commit.
- zoeapp depends on this path via symlink; moving it breaks zoeapp unless recreated.
- No .env found.
- Rating: HIGH

## Recommended action
COMMIT-PUSH

1. `cd /Users/sac/pcp && git status --porcelain | wc -l` (expect ~1205).
2. DECISION: the root scratch (patch*.js, fix_lint.js, ts_errors.txt, verify_simulator.js)
   — gitignore or delete before committing.
3. Stage by directory, explicitly: `git add src apps/template-app package.json \
    package-lock.json jest.config.js eslint.config.js` then
   `git commit -m "feat(pcp): framework/2030 sweep + template-app (migration snapshot)"`.
4. `git push origin main` ; verify `git ls-remote origin | grep $(git rev-parse HEAD)`.
5. On the new machine recreate `ln -s /Users/sac/pcp /Users/sac/zoeapp/pcp_symlink`
   (or convert zoeapp to a package dependency — DECISION).
6. `rm -rf node_modules` if present before any copy (absent now).

## First commands on the new machine
`git clone https://github.com/seanchatmangpt/pcp.git && cd pcp && npm ci && npm test`

## See Also
- ../v26.9.19/ (previous jira dir)
- /Users/sac/docs/jira/v26.11.16/README.md (master index)
