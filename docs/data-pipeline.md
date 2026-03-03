# Data Pipeline

## Where the Data Lives

The dashboard reads precomputed datasets:

- `src/data/trust-scores.json`
- `src/data/eliza-snapshot.json`
- `src/data/combined-leaderboard.json`

These files are committed and updated by automation.

## Generator

The generator script:

- `scripts/generate-scores.ts`

High-level flow:

1. Fetch closed PRs from GitHub via REST API
2. Map each PR to a trust event (`approve`, `reject`, `close`, `selfClose`)
3. Build per-contributor histories
4. Compute trust scores with `src/lib/scoring-engine.ts`
5. Fetch Eliza static API snapshots (`lifetime`, `weekly`, `monthly`, API index, repo summaries)
6. Compute cross-network `Eliza Effect` scores
7. Write all source datasets under `src/data/*`
8. Publish static API artifacts under `public/api/*` and `public/openapi.json`

GitHub mapping logic:

- `src/lib/github-data.ts`

Scoring engine:

- `src/lib/scoring-engine.ts`
- `src/lib/eliza-effect-scoring.ts`
- `src/lib/eliza-ingestion.ts`

Tracked ecosystem repositories:

- `src/config/ecosystem-repos.json`

## Automation

Scores are updated by GitHub Actions:

- `.github/workflows/update-scores.yml`

This workflow runs on:

- schedule (every 30 minutes)
- `workflow_dispatch`
- pushes to `main`

It commits updated artifacts when outputs change:

- `src/data/trust-scores.json`
- `src/data/eliza-snapshot.json`
- `src/data/combined-leaderboard.json`
- `public/api/**`
- `public/openapi.json`

## Token Requirements

The script makes many GitHub API calls (PR detail + reviews), so you should set:

```bash
export GITHUB_TOKEN="..."
```

Without a token, you will hit rate limits quickly.

## Eliza Ingestion Failure Policy

Eliza ingestion is best-effort and does not block Milady score generation.

- If Eliza endpoints fail or return malformed payloads, Milady trust output is still written.
- `src/data/eliza-snapshot.json` includes stale warnings.
- `src/data/combined-leaderboard.json` and `public/api/*` are still generated with available data.
