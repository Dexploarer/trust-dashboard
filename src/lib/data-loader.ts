import trustData from "@/data/trust-scores.json";
import { emptyCoAuthorStats, isLikelyGitHubUsername, normalizeCoAuthorStats } from "./coauthor-network";
import { isAgent as detectAgentUsername } from "./levels";
import {
  type ContributorData,
  TIERS,
  type TrustStats,
  getTierConfig,
  getTierForScore,
  type TrustTier,
} from "./trust-scoring";

interface RawContributor {
  username?: string;
  avatarUrl?: string;
  trustScore?: number;
  tier?: TrustTier;
  tierInfo?: { label?: TrustTier };
  breakdown?: ContributorData["breakdown"];
  currentStreak?: { type: "approve" | "negative" | null; length: number };
  currentStreakType?: "approve" | "negative" | null;
  currentStreakLength?: number;
  totalApprovals?: number;
  totalRejections?: number;
  totalCloses?: number;
  totalSelfCloses?: number;
  totalReviews?: number;
  totalIssues?: number;
  totalComments?: number;
  isAgent?: boolean;
  characterClass?: string;
  badges?: ContributorData["badges"];
  tags?: ContributorData["tags"];
  totalLevel?: number;
  totalXp?: number;
  coAuthorStats?: ContributorData["coAuthorStats"];
  lastEventAt?: string | null;
  firstSeenAt?: string;
  walletAddress?: string | null;
  autoMergeEligible?: boolean;
  events?: ContributorData["events"];
  scoreHistory?: ContributorData["scoreHistory"];
  warnings?: string[];
  crossNetwork?: ContributorData["crossNetwork"];
}

interface RawTrustData {
  generatedAt?: string;
  repoFullName?: string;
  contributors?: RawContributor[];
  stats?: Partial<TrustStats>;
}

export interface TrustDataSnapshot {
  generatedAt: string;
  repoFullName: string;
  contributors: ContributorData[];
  stats: TrustStats;
}

function normalizeContributors(raw: RawContributor[]): ContributorData[] {
  return raw.flatMap((contributor) => {
    const username = contributor.username?.trim();
    if (!username || !isLikelyGitHubUsername(username)) {
      return [];
    }

    const tierLabel = contributor.tier ?? contributor.tierInfo?.label ?? getTierForScore(contributor.trustScore ?? 0).label;
    const tier = getTierConfig(tierLabel);

    const currentStreak = contributor.currentStreak ?? {
      type: contributor.currentStreakType ?? null,
      length: contributor.currentStreakLength ?? 0,
    };

    const breakdown = contributor.breakdown ?? {
      rawPoints: 0,
      diminishingFactor: 0,
      recencyWeightedPoints: 0,
      streakMultiplier: 1,
      velocityPenalty: 0,
      inactivityDecay: 0,
      manualAdjustment: 0,
      eventDetails: [],
    };

    return [{
      username,
      avatarUrl: contributor.avatarUrl ?? `https://github.com/${username}.png`,
      trustScore: contributor.trustScore ?? 0,
      tier,
      tierInfo: tier,
      breakdown,
      currentStreak,
      currentStreakType: currentStreak.type === "approve" ? "approve" : currentStreak.type ? "negative" : null,
      currentStreakLength: currentStreak.length,
      totalApprovals: contributor.totalApprovals ?? 0,
      totalRejections: contributor.totalRejections ?? 0,
      totalCloses: contributor.totalCloses ?? 0,
      totalSelfCloses: contributor.totalSelfCloses ?? 0,
      totalReviews: contributor.totalReviews ?? 0,
      totalIssues: contributor.totalIssues ?? 0,
      totalComments: contributor.totalComments ?? 0,
      isAgent: contributor.isAgent ?? false,
      characterClass: (contributor.characterClass as ContributorData["characterClass"]) ?? "anon",
      badges: contributor.badges ?? [],
      tags: contributor.tags ?? [],
      totalLevel: contributor.totalLevel ?? 0,
      totalXp: contributor.totalXp ?? 0,
      coAuthorStats: normalizeCoAuthorStats(contributor.coAuthorStats ?? emptyCoAuthorStats(), detectAgentUsername),
      lastEventAt: contributor.lastEventAt ?? null,
      firstSeenAt: contributor.firstSeenAt ?? new Date().toISOString(),
      walletAddress: contributor.walletAddress ?? null,
      autoMergeEligible: contributor.autoMergeEligible ?? tier.autoMerge,
      events: contributor.events ?? [],
      scoreHistory: contributor.scoreHistory ?? [],
      warnings: contributor.warnings ?? [],
      crossNetwork: contributor.crossNetwork,
    }];
  });
}

function buildStats(contributors: ContributorData[], rawStats?: Partial<TrustStats>): TrustStats {
  const tierDistribution = TIERS.reduce((acc, tier) => {
    acc[tier.label] = 0;
    return acc;
  }, {} as Record<TrustTier, number>);

  contributors.forEach((contributor) => {
    tierDistribution[contributor.tier.label] += 1;
  });

  const avgScore = contributors.length > 0
    ? contributors.reduce((sum, contributor) => sum + contributor.trustScore, 0) / contributors.length
    : 0;

  return {
    totalContributors: rawStats?.totalContributors ?? contributors.length,
    totalEvents: rawStats?.totalEvents ?? contributors.reduce((sum, contributor) => sum + contributor.events.length, 0),
    totalCoauthoredCommits:
      rawStats?.totalCoauthoredCommits ??
      contributors.reduce((sum, contributor) => sum + contributor.coAuthorStats.totalCoauthoredCommits, 0),
    totalCoauthorPairs:
      rawStats?.totalCoauthorPairs ??
      contributors.reduce((sum, contributor) => sum + contributor.coAuthorStats.totalCoauthorPartners, 0),
    tierDistribution: {
      ...tierDistribution,
      ...(rawStats?.tierDistribution ?? {}),
    } as Record<TrustTier, number>,
    avgScore: rawStats?.avgScore ?? avgScore,
  };
}

export function normalizeTrustData(input: unknown): TrustDataSnapshot {
  const raw = (typeof input === "object" && input !== null ? input : {}) as RawTrustData;
  const contributors = normalizeContributors(Array.isArray(raw.contributors) ? raw.contributors : []);

  return {
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : new Date().toISOString(),
    repoFullName: typeof raw.repoFullName === "string" ? raw.repoFullName : "milady-ai/milaidy",
    contributors,
    stats: buildStats(contributors, raw.stats),
  };
}

const bundledSnapshot = normalizeTrustData(trustData);

export function getTrustDataSnapshot(): TrustDataSnapshot {
  return bundledSnapshot;
}

export function getContributors(): ContributorData[] {
  return bundledSnapshot.contributors;
}

export function getStats(): TrustStats {
  return bundledSnapshot.stats;
}

export function getGeneratedAt(): string {
  return bundledSnapshot.generatedAt;
}

// Backward-compatible aliases
export const loadContributors = getContributors;
export const loadStats = getStats;
