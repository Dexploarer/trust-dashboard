import type { EarnedBadge } from "./badges";
import type { CoAuthorStats } from "./coauthor-network";
import type { CharacterClass, TagScore } from "./levels";

export interface EventDetail {
  prNumber: number;
  type: string;
  basePoints: number;
  diminishingMultiplier: number;
  recencyWeight: number;
  complexityMultiplier: number;
  categoryMultiplier: number;
  streakMultiplier: number;
  severityMultiplier: number;
  weightedPoints: number;
  finalPoints: number;
  daysSinceEvent: number;
  cappedBy?: number;
}

export interface ScoreBreakdown {
  rawPoints: number;
  diminishingFactor: number;
  recencyWeightedPoints: number;
  streakMultiplier: number;
  velocityPenalty: number;
  inactivityDecay: number;
  manualAdjustment: number;
  eventDetails: EventDetail[];
}

export interface ContributorEvent {
  type: string;
  timestamp: number;
  linesChanged: number;
  labels: string[];
  prNumber: number;
  reviewSeverity?: number;
}

export interface ScoreHistoryPoint {
  timestamp: number;
  score: number;
}

export interface ContributorProfile {
  username: string;
  avatarUrl: string;
  trustScore: number;
  currentStreakType: "approve" | "negative" | null;
  currentStreakLength: number;
  totalApprovals: number;
  totalRejections: number;
  totalCloses: number;
  totalSelfCloses: number;
  totalReviews: number;
  totalIssues: number;
  totalComments: number;
  lastEventAt: string | null;
  firstSeenAt: string;
  walletAddress: string | null;
  autoMergeEligible: boolean;
  isAgent: boolean;
  characterClass: CharacterClass;
  badges: EarnedBadge[];
  tags: TagScore[];
  totalLevel: number;
  totalXp: number;
  coAuthorStats: CoAuthorStats;
  breakdown: ScoreBreakdown;
  scoreHistory: ScoreHistoryPoint[];
  events: ContributorEvent[];
  crossNetwork?: {
    elizaScore?: number;
    elizaRank?: number;
    elizaPercentile?: number;
    elizaEffectScore?: number;
    ecosystemFactor?: number;
  };
}

export interface TrustScoresDataFile {
  contributors: ContributorProfile[];
}
