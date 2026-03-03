# Deployment (GitHub Pages)

## Static Export

This repo is configured for static export:

- `next.config.ts`: `output = "export"`
- output directory: `out/`

`basePath` is set to `/trust-dashboard` so the app can be hosted under the repo path on GitHub Pages.

Static API artifacts are served from:

- `/trust-dashboard/api/*`
- `/trust-dashboard/openapi.json`

## GitHub Actions

Deployment workflow:

- `.github/workflows/deploy.yml`

Build steps:

1. Install with Bun
2. `bun run build`
3. Upload `out/` as the Pages artifact
4. Deploy to GitHub Pages

## Notes

- `next.config.ts` sets `images.unoptimized = true` to make image rendering compatible with static export.
- If you rename the repo or change the Pages path, update `basePath`.
- API artifacts are generated ahead-of-time by `scripts/generate-scores.ts` and committed by `.github/workflows/update-scores.yml`.
