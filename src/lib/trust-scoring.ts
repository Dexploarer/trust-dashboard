import type { EarnedBadge } from "./badges";
import type { CoAuthorStats } from "./coauthor-network";
import type { CharacterClass, TagScore } from "./levels";
import {
  DEFAULT_CONFIG,
  getTier,
  type EventType,
  type ScoreBreakdown,
  type TierConfig as EngineTierConfig,
  type TrustEvent as EngineTrustEvent,
  type TrustTier,
} from "./scoring-engine";

export type { EventType, TrustTier } from "./scoring-engine";

export interface TierConfig extends EngineTierConfig {
  color: string;
  bg: string;
  icon: string;
  autoMerge: boolean;
}

const TIER_VISUALS: Record<TrustTier, Omit<TierConfig, keyof EngineTierConfig>> = {
  legendary: { color: "#F59E0B", bg: "#78350F", icon: "👑", autoMerge: true },
  trusted: { color: "#10B981", bg: "#064E3B", icon: "✅", autoMerge: false },
  established: { color: "#3B82F6", bg: "#1E3A5F", icon: "🔷", autoMerge: false },
  contributing: { color: "#06B6D4", bg: "#164E63", icon: "🔧", autoMerge: false },
  probationary: { color: "#F97316", bg: "#7C2D12", icon: "⚡", autoMerge: false },
  untested: { color: "#6B7280", bg: "#1F2937", icon: "❓", autoMerge: false },
  restricted: { color: "#EF4444", bg: "#7F1D1D", icon: "🚫", autoMerge: false },
};

export const TIERS: TierConfig[] = DEFAULT_CONFIG.tiers.map((tier) => ({
  ...tier,
  ...TIER_VISUALS[tier.label],
}));

export interface TrustEvent extends EngineTrustEvent {
  id?: number | string;
  prTitle?: string;
  pointsEarned?: number;
  weightedPoints?: number;
  finalPoints?: number;
}

export interface ContributorData {
  username: string;
  avatarUrl: string;
  trustScore: number;
  tier: TierConfig;
  tierInfo: TierConfig;
  breakdown: ScoreBreakdown;
  currentStreak: {
    type: "approve" | "negative" | null;
    length: number;
  };
  currentStreakType: "approve" | "negative" | null;
  currentStreakLength: number;
  totalApprovals: number;
  totalRejections: number;
  totalCloses: number;
  totalSelfCloses: number;
  totalReviews: number;
  totalIssues: number;
  totalComments: number;
  isAgent: boolean;
  characterClass: CharacterClass;
  badges: EarnedBadge[];
  tags: TagScore[];
  totalLevel: number;
  totalXp: number;
  coAuthorStats: CoAuthorStats;
  lastEventAt: string | null;
  firstSeenAt: string;
  walletAddress: string | null;
  autoMergeEligible: boolean;
  events: TrustEvent[];
  scoreHistory: { timestamp: number; score: number }[];
  warnings: string[];
  crossNetwork?: {
    elizaScore?: number;
    elizaRank?: number;
    elizaPercentile?: number;
    elizaEffectScore?: number;
    ecosystemFactor?: number;
  };
}

export interface TrustStats {
  totalContributors: number;
  totalEvents: number;
  totalCoauthoredCommits: number;
  totalCoauthorPairs: number;
  tierDistribution: Record<TrustTier, number>;
  avgScore: number;
}

export function getTierConfig(tier: TrustTier): TierConfig {
  return TIERS.find((t) => t.label === tier) ?? TIERS[TIERS.length - 1];
}

export function getTierForScore(score: number): TierConfig {
  const tier = getTier(score, DEFAULT_CONFIG);
  return getTierConfig(tier.label);
}

export function isAutoMergeEligible(contributor: ContributorData): boolean {
  return contributor.trustScore >= TIERS[0].minScore || contributor.tier.label === "legendary";
}

export function getNextTier(score: number): TierConfig | null {
  const current = getTierForScore(score);
  const idx = TIERS.indexOf(current);
  return idx > 0 ? TIERS[idx - 1] : null;
}

export function getPointsToNextTier(score: number): number | null {
  const next = getNextTier(score);
  if (!next) return null;
  return Math.ceil(next.minScore - score);
}

export function getTotalPRs(contributor: ContributorData): number {
  return (
    contributor.totalApprovals +
    contributor.totalRejections +
    contributor.totalCloses +
    contributor.totalSelfCloses
  );
}

export function getApprovalRate(contributor: ContributorData): number {
  const total = getTotalPRs(contributor);
  if (total === 0) return 0;
  return (contributor.totalApprovals / total) * 100;
}
