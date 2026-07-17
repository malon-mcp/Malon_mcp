# Session: Fix OIDC npm publish (404 on release)

## Problem

`npm publish` from GitHub Actions fails with 404 when using OIDC Trusted Publisher. v0.6.0 succeeded via manual token; v0.6.1 and v0.6.2 both failed via OIDC.

## Root cause (diagnosed but not verified)

`actions/setup-node@v4` with `registry-url: 'https://registry.npmjs.org'` generates an `.npmrc` with `_authToken=\${NODE_AUTH_TOKEN}`. When `NODE_AUTH_TOKEN` is unset, npm tries token auth with an empty token before falling back to OIDC — and that fails.

## Fix applied (uncommitted in `.github/workflows/release.yml`)

- Removed `registry-url` from `setup-node` (default npm registry is already npmjs.org)
- Added `NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}` as env on `npm publish` step — OIDC is tried first, token is fallback
- Fixed smoke test for ESM (`require` → `import`)

## What user must do (3 steps) — PASTE THIS BLOCK:

### Step 1: Create npm Granular Access Token

- Go to https://www.npmjs.com/settings/malon-mcp/tokens
- Create a **Granular Access Token**, type **Automation**
- Scope: **Read and Write** on the `malon` package only
- Leave "Bypass 2FA" unchecked (Automation tokens bypass 2FA by design)
- Copy the token value

### Step 2: Add as GitHub secret

- Go to https://github.com/malon-mcp/Malon_mcp/settings/secrets/actions
- **New repository secret**
- Name: `NPM_TOKEN`
- Value: paste the token from step 1

### Step 3: Verify Trusted Publisher config on npm

- Go to https://www.npmjs.com/settings/malon-mcp/package/malon → Settings → Trusted Publisher
- Confirm exactly: org=`malon-mcp`, repo=`Malon_mcp`, workflow=`release.yml`
- If the npm user/org name doesn't match `malon-mcp`, that mismatch is likely the 404 root cause

## After steps 1-3 are done, agent must:

1. Commit the release.yml changes (`git add -A && git commit -m "Fix release: drop registry-url, add NPM_TOKEN fallback, fix ESM smoke test"`)
2. Bump version: edit `package.json` → `"version": "0.6.3"` (or whatever is next)
3. `git tag v0.6.3`
4. `git push && git push --tags`
5. Monitor the release run at https://github.com/malon-mcp/Malon_mcp/actions

## Git state

- HEAD: `f6c29c9` — "Merge pull request #3 from malon-mcp/fix/repository-url"
- `release.yml` has uncommitted changes (fix applied)
- Working tree also has `benchmarks/history/2026-07-16.json` (untracked, safe to ignore)

## Key files

- `.github/workflows/release.yml` — the publish workflow
- `package.json` — version at 0.6.2, has `publishConfig.provenance: true`

## Fallback if OIDC still fails

Create file `.npmrc` in repo root with:

```
//registry.npmjs.org/:_authToken=\${NODE_AUTH_TOKEN}
```

and revert to `registry-url` in `setup-node`. The token is already in secrets, so this forces token-only auth.
