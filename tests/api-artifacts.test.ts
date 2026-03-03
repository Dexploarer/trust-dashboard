import { describe, expect, test } from "bun:test";
import {
  buildApiArtifacts,
  buildCombinedLeaderboardData,
  buildOpenApiSpec,
} from "../src/lib/eliza-effect-scoring";
import { emptyCoAuthorStats } from "../src/lib/coauthor-network";
import { getTierForScore, type ContributorData } from "../src/lib/trust-scoring";

function contributor(username: string, score: number): ContributorData {
  const tier = getTierForScore(score);

  return {
    username,
    avatarUrl: `https://github.com/${username}.png`,
    trustScore: score,
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

describe("API artifacts", () => {
  test("builds required static endpoint payloads", () => {
    const combined = buildCombinedLeaderboardData({
      contributors: [contributor("alice", 90)],
      snapshot: {
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
            totalUsers: 1,
            leaderboard: [
              {
                rank: 1,
                username: "alice",
                avatarUrl: "https://github.com/alice.png",
                score: 120,
                prScore: 60,
                reviewScore: 20,
                issueScore: 10,
                commentScore: 5,
              },
            ],
          },
          weekly: {
            version: "1.0",
            period: "weekly",
            generatedAt: "2026-02-22T00:00:00.000Z",
            totalUsers: 1,
            leaderboard: [
              {
                rank: 1,
                username: "alice",
                avatarUrl: "https://github.com/alice.png",
                score: 20,
              },
            ],
          },
          monthly: {
            version: "1.0",
            period: "monthly",
            generatedAt: "2026-02-22T00:00:00.000Z",
            totalUsers: 1,
            leaderboard: [
              {
                rank: 1,
                username: "alice",
                avatarUrl: "https://github.com/alice.png",
                score: 45,
              },
            ],
          },
        },
        repoSummaries: [],
        status: { isStale: false, warnings: [] },
      },
      trackedRepos: [{ owner: "elizaOS", repo: "eliza", label: "Eliza Core", includeInEcosystemFactor: true }],
      generatedAt: "2026-02-22T00:00:00.000Z",
    });

    const artifacts = buildApiArtifacts(combined);

    expect(artifacts.index.endpoints.miladyLifetime).toBe("./leaderboards/milady/lifetime.json");
    expect(artifacts.index.endpoints.elizaEffectLifetime).toBe("./leaderboards/eliza-effect/lifetime.json");
    expect(artifacts.miladyLifetime.leaderboard).toHaveLength(1);
    expect(artifacts.elizaLifetime.leaderboard).toHaveLength(1);
    expect(artifacts.elizaEffectLifetime.leaderboard).toHaveLength(1);
    expect(artifacts.profiles.alice?.profile?.username).toBe("alice");
  });

  test("produces an OpenAPI document with declared paths", () => {
    const spec = buildOpenApiSpec("2026-02-22T00:00:00.000Z") as {
      openapi: string;
      paths: Record<string, unknown>;
      [key: string]: unknown;
    };

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/api/index.json"]).toBeDefined();
    expect(spec.paths["/api/leaderboards/eliza/lifetime.json"]).toBeDefined();
    expect(spec.paths["/api/contributors/{username}/profile.json"]).toBeDefined();
    expect(spec["x-generatedAt"]).toBe("2026-02-22T00:00:00.000Z");
  });
});
