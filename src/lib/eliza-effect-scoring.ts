import type { ContributorData } from "./trust-scoring";
import type {
  ApiArtifacts,
  CombinedLeaderboardData,
  CrossContributorProfileResponse,
  CrossNetworkContributor,
  EcosystemDataIndex,
  ElizaEffectBreakdown,
  ElizaEffectLeaderboardEntry,
  LeaderboardEnvelope,
  MiladyLeaderboardEntry,
  TrackedRepoConfig,
  TrackedRepoStatus,
  TrackedReposIndexResponse,
} from "./ecosystem-types";
import type {
  ElizaLeaderboardEntry,
  ElizaLeaderboardResponse,
  ElizaLeaderboardSnapshot,
  ElizaPeriod,
} from "./eliza-types";

export const ELIZA_EFFECT_WEIGHTS = {
  milady: 0.45,
  eliza: 0.35,
  ecosystem: 0.2,
} as const;

type MiladyContributorLike = {
  username: string;
  avatarUrl: string;
  trustScore: number;
  tier: string | { label: string };
  lastEventAt: string | null;
  totalApprovals: number;
  totalRejections: number;
  totalComments: number;
  crossNetwork?: ContributorData["crossNetwork"];
};

function tierLabel(tier: MiladyContributorLike["tier"]): string {
  return typeof tier === "string" ? tier : tier.label;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function canonicalUsername(username: string): string {
  return username.trim().toLowerCase();
}

function normalizePercentile(rank: number, totalUsers: number): number {
  const safeTotal = Math.max(1, Math.trunc(totalUsers));
  const safeRank = Math.max(1, Math.min(safeTotal, Math.trunc(rank)));
  if (safeTotal <= 1) return 1;
  return (safeTotal - safeRank) / (safeTotal - 1);
}

function round(value: number, precision = 4): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function fallbackEliza(period: ElizaPeriod, generatedAt: string): ElizaLeaderboardResponse {
  return {
    version: "1.0",
    period,
    generatedAt,
    totalUsers: 0,
    leaderboard: [],
  };
}

function toLeaderboardEnvelope<T>(
  source: string,
  period: "lifetime" | "weekly" | "monthly",
  generatedAt: string,
  leaderboard: T[],
): LeaderboardEnvelope<T> {
  return {
    version: "1.0",
    source,
    period,
    generatedAt,
    totalUsers: leaderboard.length,
    leaderboard,
  };
}

function buildMiladyLeaderboard(
  contributors: MiladyContributorLike[],
  generatedAt: string,
): LeaderboardEnvelope<MiladyLeaderboardEntry> {
  const rows = [...contributors]
    .sort((a, b) => b.trustScore - a.trustScore || a.username.localeCompare(b.username))
    .map((contributor, index) => ({
      rank: index + 1,
      username: contributor.username,
      avatarUrl: contributor.avatarUrl,
      trustScore: round(contributor.trustScore, 2),
      tier: tierLabel(contributor.tier),
      lastEventAt: contributor.lastEventAt,
      approvals: contributor.totalApprovals,
      rejections: contributor.totalRejections,
      comments: contributor.totalComments,
    }));

  return toLeaderboardEnvelope("milady-ai/milaidy", "lifetime", generatedAt, rows);
}

function buildTrackedRepoStatuses(
  trackedRepos: TrackedRepoConfig[],
  snapshot: ElizaLeaderboardSnapshot,
): TrackedRepoStatus[] {
  const summaryByRepoId = new Map(snapshot.repoSummaries.map((summary) => [summary.repoId, summary]));

  return trackedRepos.map((repo) => {
    const repoId = `${repo.owner}/${repo.repo}`.toLowerCase().replace("/", "_");
    const summary = summaryByRepoId.get(repoId);

    return {
      owner: repo.owner,
      repo: repo.repo,
      repoId,
      label: repo.label,
      includeInEcosystemFactor: repo.includeInEcosystemFactor,
      summaryStatus: summary?.status ?? "missing",
      summaryGeneratedAt: summary?.response?.generatedAt ?? null,
      summaryUrl: summary?.sourceUrl ?? "",
      summaryError: summary?.error,
    };
  });
}

function buildElizaMaps(
  leaderboard: ElizaLeaderboardEntry[],
): Map<string, ElizaLeaderboardEntry> {
  return new Map(leaderboard.map((entry) => [canonicalUsername(entry.username), entry]));
}

function ecosystemFactorFromEliza(
  elizaEntry: ElizaLeaderboardEntry | null,
  percentile: number,
  repoCoverage: number,
): number {
  if (!elizaEntry) return 0;

  const totalScore = Math.max(0.0001, elizaEntry.score);
  const prShare = clamp01((elizaEntry.prScore ?? 0) / totalScore);
  const reviewShare = clamp01((elizaEntry.reviewScore ?? 0) / totalScore);
  const issueShare = clamp01((elizaEntry.issueScore ?? 0) / totalScore);

  const activitySignal = clamp01(0.65 * percentile + 0.2 * prShare + 0.1 * reviewShare + 0.05 * issueShare);
  return clamp01(0.8 * activitySignal + 0.2 * repoCoverage);
}

function buildBreakdown(
  miladyNorm: number,
  elizaLifetimePercentile: number,
  ecosystemNorm: number,
): ElizaEffectBreakdown {
  const effectNorm =
    ELIZA_EFFECT_WEIGHTS.milady * miladyNorm +
    ELIZA_EFFECT_WEIGHTS.eliza * elizaLifetimePercentile +
    ELIZA_EFFECT_WEIGHTS.ecosystem * ecosystemNorm;

  return {
    miladyNorm: round(miladyNorm, 6),
    elizaLifetimePercentile: round(elizaLifetimePercentile, 6),
    ecosystemNorm: round(ecosystemNorm, 6),
    weights: { ...ELIZA_EFFECT_WEIGHTS },
    effectNorm: round(effectNorm, 6),
    effectScore: round(effectNorm * 100, 4),
  };
}

function buildCrossContributorRows(
  contributors: MiladyContributorLike[],
  snapshot: ElizaLeaderboardSnapshot,
  repoStatuses: TrackedRepoStatus[],
): {
  crossContributors: CrossNetworkContributor[];
  effectLeaderboard: ElizaEffectLeaderboardEntry[];
  intersectionUsernames: string[];
} {
  const miladyByUsername = new Map(contributors.map((contributor) => [canonicalUsername(contributor.username), contributor]));
  const miladyRankByUsername = new Map(
    [...contributors]
      .sort((a, b) => b.trustScore - a.trustScore || a.username.localeCompare(b.username))
      .map((entry, index) => [canonicalUsername(entry.username), index + 1]),
  );

  const lifetime = snapshot.periods.lifetime?.leaderboard ?? [];
  const weeklyByUsername = buildElizaMaps(snapshot.periods.weekly?.leaderboard ?? []);
  const monthlyByUsername = buildElizaMaps(snapshot.periods.monthly?.leaderboard ?? []);

  const elizaByUsername = buildElizaMaps(lifetime);

  const usernames = new Set<string>([
    ...[...miladyByUsername.keys()],
    ...[...elizaByUsername.keys()],
  ]);

  const includedRepoStatuses = repoStatuses.filter((repo) => repo.includeInEcosystemFactor);
  const repoCoverage = includedRepoStatuses.length > 0
    ? includedRepoStatuses.filter((repo) => repo.summaryStatus === "ok").length / includedRepoStatuses.length
    : 0;

  const crossContributors: CrossNetworkContributor[] = [];

  for (const canonical of usernames) {
    const milady = miladyByUsername.get(canonical) ?? null;
    const eliza = elizaByUsername.get(canonical) ?? null;

    const username = milady?.username ?? eliza?.username ?? canonical;
    const avatarUrl = milady?.avatarUrl ?? eliza?.avatarUrl ?? `https://github.com/${username}.png`;

    const miladyNorm = milady ? clamp01(milady.trustScore / 100) : 0;
    const elizaPercentile = eliza
      ? normalizePercentile(eliza.rank, snapshot.periods.lifetime?.totalUsers ?? lifetime.length)
      : 0;
    const ecosystemNorm = ecosystemFactorFromEliza(eliza, elizaPercentile, repoCoverage);
    const breakdown = buildBreakdown(miladyNorm, elizaPercentile, ecosystemNorm);

    const weeklyEntry = eliza ? weeklyByUsername.get(canonical) ?? null : null;
    const monthlyEntry = eliza ? monthlyByUsername.get(canonical) ?? null : null;

    crossContributors.push({
      username,
      canonicalUsername: canonical,
      avatarUrl,
      milady: milady
        ? {
          trustScore: round(milady.trustScore, 2),
          rank: miladyRankByUsername.get(canonical) ?? null,
          tier: tierLabel(milady.tier),
        }
        : null,
      eliza: eliza
        ? {
          lifetimeScore: round(eliza.score, 4),
          lifetimeRank: eliza.rank,
          lifetimePercentile: round(elizaPercentile, 6),
          weeklyRank: weeklyEntry?.rank ?? null,
          monthlyRank: monthlyEntry?.rank ?? null,
          characterClass: eliza.characterClass ?? null,
          tier: eliza.tier ?? null,
          entry: eliza,
        }
        : null,
      ecosystemFactor: round(ecosystemNorm, 6),
      elizaEffect: breakdown,
    });
  }

  const effectLeaderboard = [...crossContributors]
    .map((row): ElizaEffectLeaderboardEntry | null => {
      if (!row.elizaEffect) return null;
      return {
        rank: 0,
        username: row.username,
        avatarUrl: row.avatarUrl,
        miladyScore: row.milady?.trustScore ?? null,
        elizaLifetimeScore: row.eliza?.lifetimeScore ?? null,
        elizaLifetimeRank: row.eliza?.lifetimeRank ?? null,
        ecosystemFactor: row.elizaEffect.ecosystemNorm,
        elizaEffectScore: row.elizaEffect.effectScore,
        breakdown: row.elizaEffect,
      };
    })
    .filter((row): row is ElizaEffectLeaderboardEntry => Boolean(row))
    .sort((a, b) => b.elizaEffectScore - a.elizaEffectScore || a.username.localeCompare(b.username))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const intersectionUsernames = crossContributors
    .filter((row) => row.milady && row.eliza)
    .map((row) => row.username)
    .sort((a, b) => a.localeCompare(b));

  return {
    crossContributors: crossContributors.sort((a, b) => a.username.localeCompare(b.username)),
    effectLeaderboard,
    intersectionUsernames,
  };
}

interface BuildCombinedLeaderboardOptions {
  contributors: MiladyContributorLike[];
  snapshot: ElizaLeaderboardSnapshot;
  trackedRepos: TrackedRepoConfig[];
  generatedAt: string;
}

export function buildCombinedLeaderboardData(options: BuildCombinedLeaderboardOptions): CombinedLeaderboardData {
  const generatedAt = options.generatedAt;

  const miladyLeaderboard = buildMiladyLeaderboard(options.contributors, generatedAt);
  const trackedRepos = buildTrackedRepoStatuses(options.trackedRepos, options.snapshot);

  const lifetime = options.snapshot.periods.lifetime ?? fallbackEliza("lifetime", generatedAt);
  const weekly = options.snapshot.periods.weekly ?? fallbackEliza("weekly", generatedAt);
  const monthly = options.snapshot.periods.monthly ?? fallbackEliza("monthly", generatedAt);

  const { crossContributors, effectLeaderboard, intersectionUsernames } = buildCrossContributorRows(
    options.contributors,
    {
      ...options.snapshot,
      periods: {
        lifetime,
        weekly,
        monthly,
      },
    },
    trackedRepos,
  );

  return {
    version: "1.0",
    generatedAt,
    source: "milady-ai/trust-dashboard",
    weights: { ...ELIZA_EFFECT_WEIGHTS },
    trackedRepos,
    elizaSnapshot: {
      ...options.snapshot,
      periods: {
        lifetime,
        weekly,
        monthly,
      },
    },
    miladyLeaderboard,
    elizaLeaderboards: {
      lifetime: toLeaderboardEnvelope("elizaos.github.io", "lifetime", lifetime.generatedAt, lifetime.leaderboard),
      weekly: toLeaderboardEnvelope("elizaos.github.io", "weekly", weekly.generatedAt, weekly.leaderboard),
      monthly: toLeaderboardEnvelope("elizaos.github.io", "monthly", monthly.generatedAt, monthly.leaderboard),
    },
    elizaEffectLeaderboard: toLeaderboardEnvelope("milady+eliza", "lifetime", generatedAt, effectLeaderboard),
    crossContributors,
    intersectionUsernames,
  };
}

export function mergeCrossNetworkIntoMilady<T extends MiladyContributorLike>(
  contributors: T[],
  combined: CombinedLeaderboardData,
): T[] {
  const crossByCanonical = new Map(
    combined.crossContributors.map((row) => [canonicalUsername(row.username), row]),
  );

  return contributors.map((contributor) => {
    const cross = crossByCanonical.get(canonicalUsername(contributor.username));

    if (!cross || !cross.eliza || !cross.elizaEffect) {
      return contributor;
    }

    return {
      ...contributor,
      crossNetwork: {
        elizaScore: cross.eliza.lifetimeScore,
        elizaRank: cross.eliza.lifetimeRank,
        elizaPercentile: cross.eliza.lifetimePercentile,
        elizaEffectScore: cross.elizaEffect.effectScore,
        ecosystemFactor: cross.elizaEffect.ecosystemNorm,
      },
    } satisfies T;
  });
}

export function buildApiArtifacts(combined: CombinedLeaderboardData): ApiArtifacts {
  const endpointBase = ".";

  const index: EcosystemDataIndex = {
    version: combined.version,
    generatedAt: combined.generatedAt,
    source: combined.source,
    endpoints: {
      miladyLifetime: `${endpointBase}/leaderboards/milady/lifetime.json`,
      elizaLifetime: `${endpointBase}/leaderboards/eliza/lifetime.json`,
      elizaWeekly: `${endpointBase}/leaderboards/eliza/weekly.json`,
      elizaMonthly: `${endpointBase}/leaderboards/eliza/monthly.json`,
      elizaEffectLifetime: `${endpointBase}/leaderboards/eliza-effect/lifetime.json`,
      repos: `${endpointBase}/repos/index.json`,
      contributorProfilePattern: `${endpointBase}/contributors/{username}/profile.json`,
    },
    aliases: {
      defaultBoard: `${endpointBase}/leaderboards/eliza-effect/lifetime.json`,
      milady: `${endpointBase}/leaderboards/milady/lifetime.json`,
      eliza: `${endpointBase}/leaderboards/eliza/lifetime.json`,
      elizaEffect: `${endpointBase}/leaderboards/eliza-effect/lifetime.json`,
    },
  };

  const repos: TrackedReposIndexResponse = {
    version: combined.version,
    generatedAt: combined.generatedAt,
    source: combined.source,
    repos: combined.trackedRepos,
  };

  const profiles: Record<string, CrossContributorProfileResponse> = {};
  for (const row of combined.crossContributors) {
    profiles[row.username.toLowerCase()] = {
      version: combined.version,
      generatedAt: combined.generatedAt,
      source: combined.source,
      username: row.username,
      profile: row,
    };
  }

  return {
    index,
    miladyLifetime: combined.miladyLeaderboard,
    elizaLifetime: combined.elizaLeaderboards.lifetime,
    elizaWeekly: combined.elizaLeaderboards.weekly,
    elizaMonthly: combined.elizaLeaderboards.monthly,
    elizaEffectLifetime: combined.elizaEffectLeaderboard,
    repos,
    profiles,
  };
}

export function buildOpenApiSpec(generatedAt: string): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Milady + Eliza Sister Leaderboard API",
      version: "1.0.0",
      description: "Static JSON API artifacts for Milady trust, Eliza leaderboard, and Eliza Effect score.",
    },
    servers: [{ url: "/" }],
    paths: {
      "/api/index.json": {
        get: {
          summary: "API index",
          responses: { "200": { description: "Discovery document" } },
        },
      },
      "/api/leaderboards/milady/lifetime.json": {
        get: {
          summary: "Milady lifetime leaderboard",
          responses: { "200": { description: "Milady leaderboard response" } },
        },
      },
      "/api/leaderboards/eliza/lifetime.json": {
        get: {
          summary: "Eliza lifetime leaderboard",
          responses: { "200": { description: "Eliza leaderboard response" } },
        },
      },
      "/api/leaderboards/eliza/weekly.json": {
        get: {
          summary: "Eliza weekly leaderboard",
          responses: { "200": { description: "Eliza leaderboard response" } },
        },
      },
      "/api/leaderboards/eliza/monthly.json": {
        get: {
          summary: "Eliza monthly leaderboard",
          responses: { "200": { description: "Eliza leaderboard response" } },
        },
      },
      "/api/leaderboards/eliza-effect/lifetime.json": {
        get: {
          summary: "Eliza Effect lifetime leaderboard",
          responses: { "200": { description: "Eliza Effect leaderboard response" } },
        },
      },
      "/api/repos/index.json": {
        get: {
          summary: "Tracked repository status",
          responses: { "200": { description: "Tracked repos response" } },
        },
      },
      "/api/contributors/{username}/profile.json": {
        get: {
          summary: "Cross-network contributor profile",
          parameters: [
            {
              in: "path",
              name: "username",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "Cross contributor profile" } },
        },
      },
    },
    components: {
      schemas: {
        Metadata: {
          type: "object",
          properties: {
            version: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            source: { type: "string" },
          },
        },
      },
    },
    "x-generatedAt": generatedAt,
  };
}
