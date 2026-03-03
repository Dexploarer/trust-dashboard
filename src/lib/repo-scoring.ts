/**
 * Repository-level scoring functions.
 *
 * Produces a RepoScore for each repo in the ecosystem graph.
 * elizaEffectDensity starts at 0 and is filled in by the generation
 * script once cross-network contributor data is available.
 */

import type { RepoScore, RepoLayer } from "./ecosystem-graph-types";

// ─── Individual factors ───────────────────────────────────────────────────────

/**
 * Activity: combines EPS recency + star count proxy for PR velocity.
 * Returns 0–100.
 */
export function computeActivityScore(eps: number, updatedAt: string): number {
  const daysSince = Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
  const recencyFactor =
    daysSince < 7   ? 1.0 :
    daysSince < 30  ? 0.85 :
    daysSince < 90  ? 0.65 :
    daysSince < 180 ? 0.35 : 0.1;
  return Math.round(Math.min(100, eps * recencyFactor));
}

/**
 * Contributor health: fork-to-star ratio is a strong proxy for "developers
 * actually using this repo". High ratios (like eliza-starter at 1.56)
 * indicate a healthy, engaged developer base.
 * Returns 0–100.
 */
export function computeContributorHealth(stars: number, forks: number): number {
  if (stars === 0) return 0;
  const ratio = forks / stars;
  // Score based on fork ratio (ideal range 0.1–0.5+)
  const ratioScore = Math.min(60, ratio * 100);
  // Score based on absolute fork count (up to 40 pts)
  const volumeScore = Math.min(40, Math.log10(forks + 1) * 15);
  return Math.round(Math.min(100, ratioScore + volumeScore));
}

/**
 * Adoption: log-scaled stars + fork count. Captures organic growth.
 * Returns 0–100.
 */
export function computeAdoptionScore(stars: number, forks: number): number {
  const starScore = Math.min(60, Math.log10(stars + 1) * 15);
  const forkScore = Math.min(40, Math.log10(forks + 1) * 14);
  return Math.round(starScore + forkScore);
}

/**
 * elizaEffect density: average elizaEffect of the repo's top contributors.
 * Starts at 0 — filled in by generate-graph-data.ts once eliza data is loaded.
 */
export function computeElizaEffectDensity(
  contributorElizaEffects: number[],
): number {
  if (contributorElizaEffects.length === 0) return 0;
  const sum = contributorElizaEffects.reduce((a, b) => a + b, 0);
  return Math.round(sum / contributorElizaEffects.length);
}

// ─── Weights ─────────────────────────────────────────────────────────────────

const WEIGHTS = {
  activity:         0.30,
  contributorHealth:0.25,
  adoption:         0.25,
  elizaEffect:      0.20,
} as const;

// ─── Composite ───────────────────────────────────────────────────────────────

export function computeRepoScore(params: {
  eps: number;
  stars: number;
  forks: number;
  updatedAt: string;
  layer: RepoLayer;
  elizaEffectDensity?: number;
}): RepoScore {
  const activityScore        = computeActivityScore(params.eps, params.updatedAt);
  const contributorHealth    = computeContributorHealth(params.stars, params.forks);
  const adoptionScore        = computeAdoptionScore(params.stars, params.forks);
  const elizaEffectDensity   = params.elizaEffectDensity ?? 0;

  const overall = Math.round(
    activityScore        * WEIGHTS.activity +
    contributorHealth    * WEIGHTS.contributorHealth +
    adoptionScore        * WEIGHTS.adoption +
    elizaEffectDensity   * WEIGHTS.elizaEffect,
  );

  return { activityScore, contributorHealth, adoptionScore, elizaEffectDensity, overall };
}

// ─── elizaEffect → repo density (used by generate script) ────────────────────

/**
 * Given a map of username → elizaEffect score and a repo's contributor list,
 * return the density (mean elizaEffect of the contributors present in both sets).
 */
export function repoElizaEffectDensity(
  repoContributors: string[],
  elizaEffectByUser: Map<string, number>,
): number {
  const matched = repoContributors
    .map((u) => elizaEffectByUser.get(u.toLowerCase()))
    .filter((v): v is number => v !== undefined);
  return computeElizaEffectDensity(matched);
}
