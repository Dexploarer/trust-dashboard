import combinedData from "@/data/combined-leaderboard.json";
import { emptyElizaSnapshot } from "./eliza-ingestion";
import type {
  CombinedLeaderboardData,
  CrossNetworkContributor,
  ElizaEffectBreakdown,
  ElizaEffectLeaderboardEntry,
  MiladyLeaderboardEntry,
  TrackedRepoStatus,
} from "./ecosystem-types";
import type { ElizaLeaderboardEntry } from "./eliza-types";

function toString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : toString(value, "");
}

export function createEmptyCombinedData(now = new Date()): CombinedLeaderboardData {
  const generatedAt = now.toISOString();

  return {
    version: "1.0",
    generatedAt,
    source: "milady-ai/trust-dashboard",
    weights: {
      milady: 0.45,
      eliza: 0.35,
      ecosystem: 0.2,
    },
    trackedRepos: [],
    elizaSnapshot: emptyElizaSnapshot(now),
    miladyLeaderboard: {
      version: "1.0",
      source: "milady-ai/milaidy",
      period: "lifetime",
      generatedAt,
      totalUsers: 0,
      leaderboard: [],
    },
    elizaLeaderboards: {
      lifetime: {
        version: "1.0",
        source: "elizaos.github.io",
        period: "lifetime",
        generatedAt,
        totalUsers: 0,
        leaderboard: [],
      },
      weekly: {
        version: "1.0",
        source: "elizaos.github.io",
        period: "weekly",
        generatedAt,
        totalUsers: 0,
        leaderboard: [],
      },
      monthly: {
        version: "1.0",
        source: "elizaos.github.io",
        period: "monthly",
        generatedAt,
        totalUsers: 0,
        leaderboard: [],
      },
    },
    elizaEffectLeaderboard: {
      version: "1.0",
      source: "milady+eliza",
      period: "lifetime",
      generatedAt,
      totalUsers: 0,
      leaderboard: [],
    },
    crossContributors: [],
    intersectionUsernames: [],
  };
}

function normalizeMiladyLeaderboard(rows: unknown[]): MiladyLeaderboardEntry[] {
  const normalized: MiladyLeaderboardEntry[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const value = row as Record<string, unknown>;
    const username = toString(value.username, "");
    if (!username) continue;

    normalized.push({
      rank: Math.max(1, Math.trunc(toFiniteNumber(value.rank, 1))),
      username,
      avatarUrl: toString(value.avatarUrl, `https://github.com/${username}.png`),
      trustScore: toFiniteNumber(value.trustScore, 0),
      tier: toString(value.tier, "untested"),
      lastEventAt: typeof value.lastEventAt === "string" ? value.lastEventAt : null,
      approvals: Math.max(0, Math.trunc(toFiniteNumber(value.approvals, 0))),
      rejections: Math.max(0, Math.trunc(toFiniteNumber(value.rejections, 0))),
      comments: Math.max(0, Math.trunc(toFiniteNumber(value.comments, 0))),
    });
  }

  return normalized.sort((a, b) => a.rank - b.rank || b.trustScore - a.trustScore || a.username.localeCompare(b.username));
}

function normalizeElizaLeaderboard(rows: unknown[]): ElizaLeaderboardEntry[] {
  const normalized: ElizaLeaderboardEntry[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const value = row as Record<string, unknown>;
    const username = toString(value.username, "");
    if (!username) continue;

    normalized.push({
      rank: Math.max(1, Math.trunc(toFiniteNumber(value.rank, 1))),
      username,
      avatarUrl: toString(value.avatarUrl, `https://github.com/${username}.png`),
      characterClass: typeof value.characterClass === "string" ? value.characterClass : undefined,
      tier: typeof value.tier === "string" ? value.tier : undefined,
      score: toFiniteNumber(value.score, 0),
      prScore: toFiniteNumber(value.prScore, 0),
      issueScore: toFiniteNumber(value.issueScore, 0),
      reviewScore: toFiniteNumber(value.reviewScore, 0),
      commentScore: toFiniteNumber(value.commentScore, 0),
    });
  }

  return normalized.sort((a, b) => a.rank - b.rank || b.score - a.score || a.username.localeCompare(b.username));
}

function normalizeElizaEffect(rows: unknown[]): ElizaEffectLeaderboardEntry[] {
  const normalized: ElizaEffectLeaderboardEntry[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const value = row as Record<string, unknown>;
    const username = toString(value.username, "");
    if (!username) continue;

    normalized.push({
      rank: Math.max(1, Math.trunc(toFiniteNumber(value.rank, 1))),
      username,
      avatarUrl: toString(value.avatarUrl, `https://github.com/${username}.png`),
      miladyScore:
        value.miladyScore === null || value.miladyScore === undefined
          ? null
          : toFiniteNumber(value.miladyScore, 0),
      elizaLifetimeScore:
        value.elizaLifetimeScore === null || value.elizaLifetimeScore === undefined
          ? null
          : toFiniteNumber(value.elizaLifetimeScore, 0),
      elizaLifetimeRank:
        value.elizaLifetimeRank === null || value.elizaLifetimeRank === undefined
          ? null
          : Math.max(1, Math.trunc(toFiniteNumber(value.elizaLifetimeRank, 1))),
      ecosystemFactor: toFiniteNumber(value.ecosystemFactor, 0),
      elizaEffectScore: toFiniteNumber(value.elizaEffectScore, 0),
      breakdown: (value.breakdown ?? null) as ElizaEffectLeaderboardEntry["breakdown"],
    });
  }

  return normalized.sort((a, b) => a.rank - b.rank || b.elizaEffectScore - a.elizaEffectScore || a.username.localeCompare(b.username));
}

function toNullableRank(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Math.max(1, Math.trunc(toFiniteNumber(value, 1)));
}

function normalizeElizaEntry(
  entry: unknown,
  username: string,
  avatarUrl: string,
): ElizaLeaderboardEntry {
  if (!entry || typeof entry !== "object") {
    return {
      rank: 1,
      username,
      avatarUrl,
      score: 0,
      prScore: 0,
      issueScore: 0,
      reviewScore: 0,
      commentScore: 0,
    };
  }

  const value = entry as Record<string, unknown>;
  return {
    rank: Math.max(1, Math.trunc(toFiniteNumber(value.rank, 1))),
    username: toString(value.username, username),
    avatarUrl: toString(value.avatarUrl, avatarUrl),
    characterClass: typeof value.characterClass === "string" ? value.characterClass : undefined,
    tier: typeof value.tier === "string" ? value.tier : undefined,
    score: toFiniteNumber(value.score, 0),
    prScore: toFiniteNumber(value.prScore, 0),
    issueScore: toFiniteNumber(value.issueScore, 0),
    reviewScore: toFiniteNumber(value.reviewScore, 0),
    commentScore: toFiniteNumber(value.commentScore, 0),
  };
}

function normalizeBreakdown(value: unknown): ElizaEffectBreakdown | null {
  if (!value || typeof value !== "object") return null;
  const breakdown = value as Record<string, unknown>;
  const weights = breakdown.weights && typeof breakdown.weights === "object"
    ? (breakdown.weights as Record<string, unknown>)
    : {};

  return {
    miladyNorm: toFiniteNumber(breakdown.miladyNorm, 0),
    elizaLifetimePercentile: toFiniteNumber(breakdown.elizaLifetimePercentile, 0),
    ecosystemNorm: toFiniteNumber(breakdown.ecosystemNorm, 0),
    weights: {
      milady: toFiniteNumber(weights.milady, 0.45),
      eliza: toFiniteNumber(weights.eliza, 0.35),
      ecosystem: toFiniteNumber(weights.ecosystem, 0.2),
    },
    effectNorm: toFiniteNumber(breakdown.effectNorm, 0),
    effectScore: toFiniteNumber(breakdown.effectScore, 0),
  };
}

function normalizeCrossContributors(rows: unknown[]): CrossNetworkContributor[] {
  const normalized: CrossNetworkContributor[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const value = row as Record<string, unknown>;
    const username = toString(value.username, "");
    if (!username) continue;

    const canonicalUsername = toString(value.canonicalUsername, username.toLowerCase());
    const avatarUrl = toString(value.avatarUrl, `https://github.com/${username}.png`);

    const miladyValue = value.milady;
    const milady = miladyValue && typeof miladyValue === "object"
      ? (() => {
        const record = miladyValue as Record<string, unknown>;
        return {
          trustScore: toFiniteNumber(record.trustScore, 0),
          rank: toNullableRank(record.rank),
          tier: toNullableString(record.tier),
        };
      })()
      : null;

    const elizaValue = value.eliza;
    const eliza = elizaValue && typeof elizaValue === "object"
      ? (() => {
        const record = elizaValue as Record<string, unknown>;
        return {
          lifetimeScore: toFiniteNumber(record.lifetimeScore, 0),
          lifetimeRank: Math.max(1, Math.trunc(toFiniteNumber(record.lifetimeRank, 1))),
          lifetimePercentile: toFiniteNumber(record.lifetimePercentile, 0),
          weeklyRank: toNullableRank(record.weeklyRank),
          monthlyRank: toNullableRank(record.monthlyRank),
          characterClass: toNullableString(record.characterClass),
          tier: toNullableString(record.tier),
          entry: normalizeElizaEntry(record.entry, username, avatarUrl),
        };
      })()
      : null;

    normalized.push({
      username,
      canonicalUsername,
      avatarUrl,
      milady,
      eliza,
      ecosystemFactor: toFiniteNumber(value.ecosystemFactor, 0),
      elizaEffect: normalizeBreakdown(value.elizaEffect),
    });
  }

  return normalized;
}

function normalizeTrackedRepos(rows: unknown[]): TrackedRepoStatus[] {
  const normalized: TrackedRepoStatus[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const value = row as Record<string, unknown>;
    const owner = toString(value.owner, "");
    const repo = toString(value.repo, "");
    if (!owner || !repo) continue;

    normalized.push({
      owner,
      repo,
      repoId: toString(value.repoId, `${owner}/${repo}`),
      label: toString(value.label, `${owner}/${repo}`),
      includeInEcosystemFactor: Boolean(value.includeInEcosystemFactor),
      summaryStatus: ["ok", "missing", "error"].includes(toString(value.summaryStatus, ""))
        ? (toString(value.summaryStatus, "missing") as TrackedRepoStatus["summaryStatus"])
        : "missing",
      summaryGeneratedAt: typeof value.summaryGeneratedAt === "string" ? value.summaryGeneratedAt : null,
      summaryUrl: toString(value.summaryUrl, ""),
      summaryError: typeof value.summaryError === "string" ? value.summaryError : undefined,
    });
  }

  return normalized;
}

export function normalizeCombinedData(input: unknown): CombinedLeaderboardData {
  const empty = createEmptyCombinedData();
  if (!input || typeof input !== "object") return empty;

  const value = input as Record<string, unknown>;

  const miladyRows = normalizeMiladyLeaderboard(
    (value.miladyLeaderboard as Record<string, unknown> | undefined)?.leaderboard as unknown[] ?? [],
  );
  const elizaLifetimeRows = normalizeElizaLeaderboard(
    (value.elizaLeaderboards as Record<string, unknown> | undefined)?.lifetime
      ? ((value.elizaLeaderboards as Record<string, unknown>).lifetime as Record<string, unknown>).leaderboard as unknown[]
      : [],
  );
  const elizaWeeklyRows = normalizeElizaLeaderboard(
    (value.elizaLeaderboards as Record<string, unknown> | undefined)?.weekly
      ? ((value.elizaLeaderboards as Record<string, unknown>).weekly as Record<string, unknown>).leaderboard as unknown[]
      : [],
  );
  const elizaMonthlyRows = normalizeElizaLeaderboard(
    (value.elizaLeaderboards as Record<string, unknown> | undefined)?.monthly
      ? ((value.elizaLeaderboards as Record<string, unknown>).monthly as Record<string, unknown>).leaderboard as unknown[]
      : [],
  );
  const effectRows = normalizeElizaEffect(
    (value.elizaEffectLeaderboard as Record<string, unknown> | undefined)?.leaderboard as unknown[] ?? [],
  );

  return {
    ...empty,
    version: toString(value.version, empty.version),
    generatedAt: toString(value.generatedAt, empty.generatedAt),
    source: toString(value.source, empty.source),
    weights: {
      milady: toFiniteNumber((value.weights as Record<string, unknown> | undefined)?.milady, empty.weights.milady),
      eliza: toFiniteNumber((value.weights as Record<string, unknown> | undefined)?.eliza, empty.weights.eliza),
      ecosystem: toFiniteNumber((value.weights as Record<string, unknown> | undefined)?.ecosystem, empty.weights.ecosystem),
    },
    trackedRepos: normalizeTrackedRepos(Array.isArray(value.trackedRepos) ? value.trackedRepos : []),
    elizaSnapshot:
      value.elizaSnapshot && typeof value.elizaSnapshot === "object"
        ? (value.elizaSnapshot as CombinedLeaderboardData["elizaSnapshot"])
        : empty.elizaSnapshot,
    miladyLeaderboard: {
      version: toString((value.miladyLeaderboard as Record<string, unknown> | undefined)?.version, "1.0"),
      source: toString((value.miladyLeaderboard as Record<string, unknown> | undefined)?.source, "milady-ai/milaidy"),
      period: "lifetime",
      generatedAt: toString((value.miladyLeaderboard as Record<string, unknown> | undefined)?.generatedAt, empty.generatedAt),
      totalUsers: miladyRows.length,
      leaderboard: miladyRows,
    },
    elizaLeaderboards: {
      lifetime: {
        version: toString(
          ((value.elizaLeaderboards as Record<string, unknown> | undefined)?.lifetime as Record<string, unknown> | undefined)?.version,
          "1.0",
        ),
        source: "elizaos.github.io",
        period: "lifetime",
        generatedAt: toString(
          ((value.elizaLeaderboards as Record<string, unknown> | undefined)?.lifetime as Record<string, unknown> | undefined)?.generatedAt,
          empty.generatedAt,
        ),
        totalUsers: elizaLifetimeRows.length,
        leaderboard: elizaLifetimeRows,
      },
      weekly: {
        version: toString(
          ((value.elizaLeaderboards as Record<string, unknown> | undefined)?.weekly as Record<string, unknown> | undefined)?.version,
          "1.0",
        ),
        source: "elizaos.github.io",
        period: "weekly",
        generatedAt: toString(
          ((value.elizaLeaderboards as Record<string, unknown> | undefined)?.weekly as Record<string, unknown> | undefined)?.generatedAt,
          empty.generatedAt,
        ),
        totalUsers: elizaWeeklyRows.length,
        leaderboard: elizaWeeklyRows,
      },
      monthly: {
        version: toString(
          ((value.elizaLeaderboards as Record<string, unknown> | undefined)?.monthly as Record<string, unknown> | undefined)?.version,
          "1.0",
        ),
        source: "elizaos.github.io",
        period: "monthly",
        generatedAt: toString(
          ((value.elizaLeaderboards as Record<string, unknown> | undefined)?.monthly as Record<string, unknown> | undefined)?.generatedAt,
          empty.generatedAt,
        ),
        totalUsers: elizaMonthlyRows.length,
        leaderboard: elizaMonthlyRows,
      },
    },
    elizaEffectLeaderboard: {
      version: toString((value.elizaEffectLeaderboard as Record<string, unknown> | undefined)?.version, "1.0"),
      source: toString((value.elizaEffectLeaderboard as Record<string, unknown> | undefined)?.source, "milady+eliza"),
      period: "lifetime",
      generatedAt: toString((value.elizaEffectLeaderboard as Record<string, unknown> | undefined)?.generatedAt, empty.generatedAt),
      totalUsers: effectRows.length,
      leaderboard: effectRows,
    },
    crossContributors: normalizeCrossContributors(Array.isArray(value.crossContributors) ? value.crossContributors : []),
    intersectionUsernames: Array.isArray(value.intersectionUsernames)
      ? value.intersectionUsernames.filter((item): item is string => typeof item === "string")
      : [],
  };
}

const BUNDLED_DATA = normalizeCombinedData(combinedData);

export function getCombinedLeaderboardSnapshot(): CombinedLeaderboardData {
  return BUNDLED_DATA;
}

export function findCrossContributor(username: string): CrossNetworkContributor | null {
  const canonical = username.trim().toLowerCase();
  return BUNDLED_DATA.crossContributors.find((entry) => entry.username.toLowerCase() === canonical) ?? null;
}
