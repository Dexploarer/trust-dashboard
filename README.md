# trust-dashboard

> Contributor trust scoring and ecosystem visualization for the [milady-ai](https://github.com/milady-ai) and [elizaOS](https://github.com/elizaOS) open-source communities.

Live: **[104.236.109.83/trust-dashboard](http://104.236.109.83/trust-dashboard)**

---

## What it is

trust-dashboard is a static Next.js application that does two things:

1. **Trust scoring** — assigns every contributor to `milady-ai/milaidy` a dynamic reputation score (0–100) based on their PR review history, updated every 30 minutes via GitHub Actions.

2. **Ecosystem graph** — maps the entire elizaOS repository network (57 repos, 35 typed edges) as an interactive force-directed graph, showing how plugins, starters, agents, and tooling relate to the core runtime.

The goal is to make contributor reputation and project health legible at a glance — without requiring a database, a backend, or a login.

---

## Goals

- **Transparent reputation** — every score is fully reproducible from public GitHub data. The algorithm is documented, testable, and consistent between the generation script and the UI simulator.
- **Decentralized trust** — scores are committed to the repo as JSON and served as static files. No centralized authority, no opaque ML model.
- **Ecosystem awareness** — the elizaOS plugin ecosystem is large and fast-moving. The graph surface makes it easy to see what depends on what, what's in the official registry, and where new contributors are active.
- **Zero runtime cost** — static export means the dashboard can be self-hosted anywhere (S3, GitHub Pages, a $6 droplet) with no Node.js process to maintain.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Leaderboard — sort and filter contributors by trust score, tier, and activity |
| `/contributor/:username` | Profile — full score breakdown, history sparkline, badges, and XP level |
| `/ecosystem` | Cross-network leaderboard — Milady × Eliza Effect composite scores |
| `/ecosystem/graph` | Interactive force-directed graph of the elizaOS repo network |
| `/scoring` | Algorithm explainer — factor weights, tier thresholds, interactive SVG charts |
| `/simulator` | Score calculator — simulate how PRs affect a score in real time |

---

## Trust Algorithm

Scores start at **35** and range from **0–100**. Eight factors apply on every PR action:

| Factor | Description |
|--------|-------------|
| Base points | approve +12, reject −6, close −10, self-close −2 |
| Diminishing returns | `1 / (1 + 0.2 × ln(1 + priorApprovals))` — prevents farming |
| Recency decay | half-life 45 days — old reviews matter less over time |
| Complexity multiplier | 0.4× (trivial, ≤10 lines) → 1.5× (xlarge, ≤1500 lines) |
| Category weight | security 1.8×, critical-fix 1.5×, chore 0.5×, aesthetic 0.4× |
| Streaks | +8% per consecutive approval (cap 50%), +15% penalty per rejection (cap 2.5×) |
| Velocity gate | soft cap 10 PRs/7d (−15%/excess), hard cap 25 PRs/7d |
| Inactivity decay | after 10-day grace: 0.5%/day toward target 40, floor 30 |

Daily cap: **+35 raw points** per calendar day.

### Trust Tiers

| Tier | Score | Privilege |
|------|-------|-----------|
| Legendary | ≥ 90 | Auto-merge eligible |
| Trusted | ≥ 75 | |
| Established | ≥ 60 | |
| Contributing | ≥ 45 | |
| Probationary | ≥ 30 | |
| Untested | ≥ 15 | |
| Restricted | ≥ 0 | |

---

## Ecosystem Graph

The `/ecosystem/graph` page renders 57 elizaOS repositories as a physics-based force graph across six conceptual layers:

| Layer | Label | Example repos |
|-------|-------|---------------|
| L0 | Core runtime | elizaOS/eliza |
| L1 | Foundational spec | elizaOS/characterfile, elizaOS/agent-twitter-client |
| L2 | Official packages | elizaOS/plugin-bootstrap, elizaOS/plugin-node |
| L3 | Tools & agents | elizaOS/agentbrowser, elizaOS/spartan |
| L4 | Community plugins | 20+ community-contributed plugins |
| L5 | Peripheral | Docs, status pages, websites |

Edge types: `dependency` · `foundation` · `registry` · `tool-family` · `starter-chain`

Each repo is scored using four factors (activity, contributor health, adoption, elizaEffect density) into a composite **RepoScore**.

---

## Eliza Effect

The **Eliza Effect** is a composite signal measuring how deeply a contributor spans both the Milady and elizaOS ecosystems:

```
elizaEffect = milady_trust × 0.45 + eliza_lifetime × 0.35 + ecosystem_activity × 0.20
```

Contributors with high Eliza Effect scores are active in both communities — a strong proxy for cross-project influence.

---

## Data Pipeline

```
GitHub API
    │
    ▼
scripts/generate-scores.ts          (runs every 30 min via GH Actions)
    │  fetches all PRs, computes 8-factor scores
    ▼
src/data/trust-scores.json          (committed to repo)
    │
    ▼
Next.js static build                (triggered on push)
    │  all pages pre-rendered at build time
    ▼
out/                                (static HTML + assets)
    │
    ▼
nginx /trust-dashboard              (served from /var/www/trust-dashboard)
```

The ecosystem graph data follows the same pattern via `scripts/generate-graph-data.ts`, refreshed every 6 hours.

---

## Stack

- **Next.js 15** — App Router, static export (`output: "export"`)
- **React 19** — strict TypeScript throughout
- **Tailwind CSS v4** — dark theme, CSS variable tokens
- **Bun** — package manager and script runner
- **Recharts** — score history sparklines
- **Radix UI** — accessible component primitives
- **Custom SVG physics** — force-directed graph with no external graph library

---

## Development

```bash
# Install
bun install

# Dev server
bun run dev

# Type check + lint + scoring tests
bun run check

# Generate trust score data (requires GITHUB_TOKEN)
bun run scripts/generate-scores.ts

# Generate ecosystem graph data
bun run generate-graph

# Build static export
bun run build
```

The scoring algorithm is tested by `scripts/verify-scoring-sync.ts` — 7 deterministic scenarios that verify the generation script and the UI simulator produce identical results.

---

## Structure

```
src/
├── app/
│   ├── page.tsx                  Leaderboard
│   ├── contributor/[username]/   Profile pages (statically pre-generated)
│   ├── ecosystem/                Cross-network leaderboard + graph
│   ├── scoring/                  Algorithm explainer
│   └── simulator/                Interactive score calculator
├── lib/
│   ├── scoring-engine.ts         8-factor trust algorithm (568 lines)
│   ├── ecosystem-graph-types.ts  Graph node/link interfaces
│   ├── repo-scoring.ts           Repo-level scoring functions
│   └── ...
├── components/
│   ├── ecosystem-graph.tsx       Custom SVG force simulation
│   └── ...
├── data/
│   ├── trust-scores.json         Generated — do not edit manually
│   └── ecosystem-graph.json      Generated — do not edit manually
scripts/
├── generate-scores.ts            Trust score data pipeline
├── generate-graph-data.ts        Ecosystem graph data pipeline
└── verify-scoring-sync.ts        Scoring test suite
docs/
└── schema.sql                    PostgreSQL DDL (future DB migration path)
```

---

## License

MIT
