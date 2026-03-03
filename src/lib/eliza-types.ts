export type ElizaPeriod = "lifetime" | "weekly" | "monthly";

export interface ElizaFocusArea {
  tag: string;
  score: number;
  percentage: number;
  rank?: number;
  totalInArea?: number;
}

export interface ElizaAchievement {
  type: string;
  tier: string;
  earnedAt?: string;
}

export interface ElizaWallets {
  ethereum?: string;
  solana?: string;
  [chain: string]: string | undefined;
}

export interface ElizaLeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string;
  characterClass?: string;
  tier?: string;
  score: number;
  prScore?: number;
  issueScore?: number;
  reviewScore?: number;
  commentScore?: number;
  percentile?: number;
  focusAreas?: ElizaFocusArea[];
  achievements?: ElizaAchievement[];
  wallets?: ElizaWallets;
}

export interface ElizaLeaderboardResponse {
  version: string;
  period: ElizaPeriod;
  generatedAt: string;
  startDate?: string;
  endDate?: string;
  totalUsers: number;
  leaderboard: ElizaLeaderboardEntry[];
}

export interface ElizaApiIndex {
  version: string;
  baseUrl?: string;
  documentation?: string;
  openapi?: string;
  endpoints?: {
    leaderboard?: Record<string, string>;
    profiles?: { pattern?: string; example?: string };
    summaries?: {
      overall?: { pattern?: string; intervals?: string[] };
      contributors?: { pattern?: string; intervals?: string[] };
      repos?: { pattern?: string; intervals?: string[] };
    };
  };
}

export interface ElizaRepoSummaryResponse {
  version: string;
  type: string;
  interval: string;
  date: string;
  generatedAt: string;
  sourceLastUpdated?: string;
  entity?: {
    repoId?: string;
    owner?: string;
    repo?: string;
  };
  contentFormat?: string;
  contentHash?: string;
  content?: string;
}

export interface ElizaRepoSummarySnapshot {
  repoId: string;
  interval: "week";
  sourceUrl: string;
  fetchedAt: string;
  status: "ok" | "missing" | "error";
  response: ElizaRepoSummaryResponse | null;
  error?: string;
}

export interface ElizaIngestionStatus {
  isStale: boolean;
  warnings: string[];
}

export interface ElizaLeaderboardSnapshot {
  version: string;
  source: string;
  generatedAt: string;
  fetchedAt: string;
  index: ElizaApiIndex | null;
  periods: Record<ElizaPeriod, ElizaLeaderboardResponse | null>;
  repoSummaries: ElizaRepoSummarySnapshot[];
  status: ElizaIngestionStatus;
}
