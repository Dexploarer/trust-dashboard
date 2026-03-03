import { describe, expect, test } from "bun:test";
import { buildCombinedLeaderboardData } from "../src/lib/eliza-effect-scoring";
import type { TrackedRepoConfig } from "../src/lib/ecosystem-types";
import type { ElizaLeaderboardSnapshot } from "../src/lib/eliza-types";
import { emptyCoAuthorStats } from "../src/lib/coauthor-network";
import { getTierForScore, type ContributorData } from "../src/lib/trust-scoring";

function makeContributor(username: string, trustScore: number): ContributorData {
  const tier = getTierForScore(trustScore);

  return {
    username,
    avatarUrl: `https://github.com/${username}.png`,
    trustScore,
    tier,
    tierInfo: tier,
    breakdown: {
      rawPoints: 0,
      diminishingFactor: 0,
      recencyWeightedPoints: 0,
      streakMultiplier: 1,
      velocityPenalty: 0,
      inactivityDecay: 0,
      manualAdjustment: 0,
      eventDetails: [],
    },
    currentStreak: { type: null, length: 0 },
    currentStreakType: null,
    currentStreakLength: 0,
    totalApprovals: 0,
    totalRejections: 0,
    totalCloses: 0,
    totalSelfCloses: 0,
    totalReviews: 0,
    totalIssues: 0,
    totalComments: 0,
    isAgent: false,
    characterClass: "anon",
    badges: [],
    tags: [],
    totalLevel: 0,
    totalXp: 0,
    coAuthorStats: emptyCoAuthorStats(),
    lastEventAt: null,
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    walletAddress: null,
    autoMergeEligible: false,
    events: [],
    scoreHistory: [],
    warnings: [],
  };
}

function makeSnapshot(): ElizaLeaderboardSnapshot {
  return {
    version: "1.0",
    source: "https://elizaos.github.io",
    generatedAt: "2026-02-22T00:00:00.000Z",
    fetchedAt: "2026-02-22T00:00:00.000Z",
    index: null,
    periods: {
      lifetime: {
        version: "1.0",
        period: "lifetime",
        generatedAt: "2026-02-22T00:00:00.000Z",
        totalUsers: 2,
        leaderboard: [
          {
            rank: 1,
            username: "alice",
            avatarUrl: "https://example.com/a.png",
            score: 100,
            prScore: 50,
            reviewScore: 20,
            issueScore: 10,
            commentScore: 5,
          },
          {
            rank: 2,
            username: "bob",
            avatarUrl: "https://example.com/b.png",
            score: 20,
            prScore: 10,
            reviewScore: 2,
            issueScore: 1,
            commentScore: 1,
          },
        ],
      },
      weekly: {
        version: "1.0",
        period: "weekly",
        generatedAt: "2026-02-22T00:00:00.000Z",
        totalUsers: 1,
        leaderboard: [{ rank: 1, username: "alice", avatarUrl: "https://example.com/a.png", score: 10 }],
      },
      monthly: {
        version: "1.0",
        period: "monthly",
        generatedAt: "2026-02-22T00:00:00.000Z",
        totalUsers: 1,
        leaderboard: [{ rank: 1, username: "alice", avatarUrl: "https://example.com/a.png", score: 40 }],
      },
    },
    repoSummaries: [
      {
        repoId: "elizaos_eliza",
        interval: "week",
        sourceUrl: "https://example.com/ok",
        fetchedAt: "2026-02-22T00:00:00.000Z",
        status: "ok",
        response: {
          version: "1.0",
          type: "repository",
          interval: "week",
          date: "2026-02-22",
          generatedAt: "2026-02-22T00:00:00.000Z",
          content: "ok",
        },
      },
      {
        repoId: "milady-ai_milaidy",
        interval: "week",
        sourceUrl: "https://example.com/missing",
        fetchedAt: "2026-02-22T00:00:00.000Z",
        status: "missing",
        response: null,
        error: "not found",
      },
    ],
    status: {
      isStale: false,
      warnings: [],
    },
  };
}

describe("buildCombinedLeaderboardData", () => {
  test("computes Eliza Effect using 45/35/20 formula", () => {
    const contributors = [makeContributor("Alice", 80), makeContributor("charlie", 50)];
    const trackedRepos: TrackedRepoConfig[] = [
      { owner: "elizaOS", repo: "eliza", label: "Eliza Core", includeInEcosystemFactor: true },
      { owner: "milady-ai", repo: "milaidy", label: "Milady", includeInEcosystemFactor: true },
    ];

    const combined = buildCombinedLeaderboardData({
      contributors,
      snapshot: makeSnapshot(),
      trackedRepos,
      generatedAt: "2026-02-22T00:00:00.000Z",
    });

    const alice = combined.elizaEffectLeaderboard.leaderboard.find((entry) => entry.username.toLowerCase() === "alice");
    expect(alice).toBeDefined();
    expect(alice?.elizaEffectScore).toBeCloseTo(85.4, 1);

    const charlie = combined.crossContributors.find((entry) => entry.username.toLowerCase() === "charlie");
    expect(charlie?.eliza?.lifetimeScore).toBeUndefined();
    expect(charlie?.elizaEffect?.elizaLifetimePercentile).toBe(0);
  });

  test("matches usernames case-insensitively and does not alias unrelated names", () => {
    const contributors = [makeContributor("Alice", 80), makeContributor("alice-dev", 75)];

    const snapshot = makeSnapshot();
    snapshot.periods.lifetime!.leaderboard[0]!.username = "ALICE";

    const combined = buildCombinedLeaderboardData({
      contributors,
      snapshot,
      trackedRepos: [{ owner: "elizaOS", repo: "eliza", label: "Eliza Core", includeInEcosystemFactor: true }],
      generatedAt: "2026-02-22T00:00:00.000Z",
    });

    const alice = combined.crossContributors.find((entry) => entry.username.toLowerCase() === "alice");
    const aliceDev = combined.crossContributors.find((entry) => entry.username.toLowerCase() === "alice-dev");

    expect(alice?.milady?.trustScore).toBe(80);
    expect(alice?.eliza?.lifetimeRank).toBe(1);
    expect(aliceDev?.eliza).toBeNull();
  });
});
