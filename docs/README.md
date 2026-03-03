# Docs

This directory contains the documentation and assets for the Milaidy Trust Dashboard.

## Index

- `docs/scoring.md` (algorithm + constants)
- `docs/data-pipeline.md` (how scores are generated)
- `docs/api.md` (static API endpoints + contracts)
- `docs/development.md` (local dev + checks)
- `docs/deployment.md` (GitHub Pages export)
- `docs/screenshot.png` (README screenshot)

## Refresh Trust Scores Data

`src/data/trust-scores.json`, `src/data/eliza-snapshot.json`, and `src/data/combined-leaderboard.json` are generated from GitHub + Eliza snapshots.

1. Export a GitHub token with access to `milady-ai/milaidy`:

```bash
export GITHUB_TOKEN="..."
```

2. Run the generator:

```bash
bun run scripts/generate-scores.ts
```

This uses the GitHub API and will hit rate limits without a token.

## Refresh README Screenshot

1. Start the dev server:

```bash
bun run dev
```

2. Capture the screenshot.

Option A: Playwright CLI wrapper (requires `npx` on PATH):

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
export PLAYWRIGHT_CLI_SESSION=trust-dashboard-readme

mkdir -p output/playwright/readme-screenshot
cd output/playwright/readme-screenshot

"$PWCLI" open "http://localhost:3000/trust-dashboard" --headed
"$PWCLI" resize 2048 1105
"$PWCLI" run-code "await page.waitForTimeout(1500)"
"$PWCLI" screenshot --filename "../../../docs/screenshot.png"
```

Option B: Playwright via `bunx` (works without `npx`):

```bash
bunx playwright screenshot --viewport-size=2048,1105 --wait-for-timeout=1500 --full-page "http://localhost:3000/trust-dashboard" "docs/screenshot.png"
```
