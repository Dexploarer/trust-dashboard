import type { ElizaLeaderboardEntry, ElizaLeaderboardSnapshot } from "./eliza-types";

export interface TrackedRepoConfig {
  owner: string;
  repo: string;
  label: string;
  includeInEcosystemFactor: boolean;
}

export interface TrackedRepoStatus {
  owner: string;
  repo: string;
  repoId: string;
  label: string;
  includeInEcosystemFactor: boolean;
  summaryStatus: "ok" | "missing" | "error";
  summaryGeneratedAt: string | null;
  summaryUrl: string;
  summaryError?: string;
}

export interface ElizaEffectBreakdown {
  miladyNorm: number;
  elizaLifetimePercentile: number;
  ecosystemNorm: number;
  weights: {
    milady: number;
    eliza: number;
    ecosystem: number;
  };
  effectNorm: number;
  effectScore: number;
}

export interface CrossNetworkContributor {
  username: string;
  canonicalUsername: string;
  avatarUrl: string;
  milady: {
    trustScore: number;
    rank: number | null;
    tier: string | null;
  } | null;
  eliza: {
    lifetimeScore: number;
    lifetimeRank: number;
    lifetimePercentile: number;
    weeklyRank: number | null;
    monthlyRank: number | null;
    characterClass: string | null;
    tier: string | null;
    entry: ElizaLeaderboardEntry;
  } | null;
  ecosystemFactor: number;
  elizaEffect: ElizaEffectBreakdown | null;
}

export interface LeaderboardEnvelope<T> {
  version: string;
  source: string;
  period: "lifetime" | "weekly" | "monthly";
  generatedAt: string;
  totalUsers: number;
  leaderboard: T[];
}

export interface MiladyLeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string;
  trustScore: number;
  tier: string;
  lastEventAt: string | null;
  approvals: number;
  rejections: number;
  comments: number;
}

export interface ElizaEffectLeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string;
  miladyScore: number | null;
  elizaLifetimeScore: number | null;
  elizaLifetimeRank: number | null;
  ecosystemFactor: number;
  elizaEffectScore: number;
  breakdown: ElizaEffectBreakdown;
}

export interface CrossContributorProfileResponse {
  version: string;
  generatedAt: string;
  source: string;
  username: string;
  profile: CrossNetworkContributor | null;
}

export interface TrackedReposIndexResponse {
  version: string;
  generatedAt: string;
  source: string;
  repos: TrackedRepoStatus[];
}

export interface CombinedLeaderboardData {
  version: string;
  generatedAt: string;
  source: string;
  weights: {
    milady: number;
    eliza: number;
    ecosystem: number;
  };
  trackedRepos: TrackedRepoStatus[];
  elizaSnapshot: ElizaLeaderboardSnapshot;
  miladyLeaderboard: LeaderboardEnvelope<MiladyLeaderboardEntry>;
  elizaLeaderboards: {
    lifetime: LeaderboardEnvelope<ElizaLeaderboardEntry>;
    weekly: LeaderboardEnvelope<ElizaLeaderboardEntry>;
    monthly: LeaderboardEnvelope<ElizaLeaderboardEntry>;
  };
  elizaEffectLeaderboard: LeaderboardEnvelope<ElizaEffectLeaderboardEntry>;
  crossContributors: CrossNetworkContributor[];
  intersectionUsernames: string[];
}

export interface EcosystemDataIndex {
  version: string;
  generatedAt: string;
  source: string;
  endpoints: {
    miladyLifetime: string;
    elizaLifetime: string;
    elizaWeekly: string;
    elizaMonthly: string;
    elizaEffectLifetime: string;
    repos: string;
    contributorProfilePattern: string;
  };
  aliases: {
    defaultBoard: string;
    milady: string;
    eliza: string;
    elizaEffect: string;
  };
}

export interface ApiArtifacts {
  index: EcosystemDataIndex;
  miladyLifetime: LeaderboardEnvelope<MiladyLeaderboardEntry>;
  elizaLifetime: LeaderboardEnvelope<ElizaLeaderboardEntry>;
  elizaWeekly: LeaderboardEnvelope<ElizaLeaderboardEntry>;
  elizaMonthly: LeaderboardEnvelope<ElizaLeaderboardEntry>;
  elizaEffectLifetime: LeaderboardEnvelope<ElizaEffectLeaderboardEntry>;
  repos: TrackedReposIndexResponse;
  profiles: Record<string, CrossContributorProfileResponse>;
}
