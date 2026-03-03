import { describe, expect, test } from "bun:test";
import type { TrackedRepoConfig } from "../src/lib/ecosystem-types";
import { fetchElizaSnapshot, toElizaRepoId } from "../src/lib/eliza-ingestion";

type MockFetch = typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html" },
  });
}

describe("toElizaRepoId", () => {
  test("normalizes owner/repo to eliza repo id", () => {
    expect(toElizaRepoId("elizaOS", "eliza")).toBe("elizaos_eliza");
    expect(toElizaRepoId("milady-ai", "milaidy")).toBe("milady-ai_milaidy");
  });
});

describe("fetchElizaSnapshot", () => {
  test("returns normalized data when all core leaderboard endpoints succeed", async () => {
    const trackedRepos: TrackedRepoConfig[] = [
      { owner: "elizaOS", repo: "eliza", label: "Eliza Core", includeInEcosystemFactor: true },
      { owner: "milady-ai", repo: "milaidy", label: "Milady", includeInEcosystemFactor: true },
    ];

    const mockFetch: MockFetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.endsWith("/api/index.json")) {
        return jsonResponse({ version: "1.0", endpoints: { leaderboard: {} } });
      }

      if (url.endsWith("/api/leaderboard-lifetime.json")) {
        return jsonResponse({
          version: "1.0",
          period: "lifetime",
          generatedAt: "2026-02-22T00:00:00.000Z",
          totalUsers: 2,
          leaderboard: [
            { rank: 1, username: "alice", score: 100, avatarUrl: "https://example.com/a.png" },
            { rank: 2, username: "bob", score: 50, avatarUrl: "https://example.com/b.png" },
          ],
        });
      }

      if (url.endsWith("/api/leaderboard-weekly.json") || url.endsWith("/api/leaderboard-monthly.json")) {
        return jsonResponse({
          version: "1.0",
          generatedAt: "2026-02-22T00:00:00.000Z",
          totalUsers: 1,
          leaderboard: [{ rank: 1, username: "alice", score: 10 }],
        });
      }

      if (url.includes("/api/summaries/repos/elizaos_eliza/week/latest.json")) {
        return jsonResponse({
          version: "1.0",
          type: "repository",
          interval: "week",
          date: "2026-02-22",
          generatedAt: "2026-02-22T00:00:00.000Z",
          entity: { repoId: "elizaos/eliza", owner: "elizaos", repo: "eliza" },
          content: "ok",
        });
      }

      if (url.includes("/api/summaries/repos/milady-ai_milaidy/week/latest.json")) {
        return htmlResponse("not found", 404);
      }

      return htmlResponse("unexpected", 500);
    };

    const snapshot = await fetchElizaSnapshot({ trackedRepos, fetchImpl: mockFetch, retries: 0, timeoutMs: 1_000 });

    expect(snapshot.periods.lifetime?.leaderboard).toHaveLength(2);
    expect(snapshot.periods.lifetime?.leaderboard[0]?.username).toBe("alice");
    expect(snapshot.repoSummaries).toHaveLength(2);
    expect(snapshot.repoSummaries.find((repo) => repo.repoId === "elizaos_eliza")?.status).toBe("ok");
    expect(snapshot.repoSummaries.find((repo) => repo.repoId === "milady-ai_milaidy")?.status).toBe("missing");
    expect(snapshot.status.isStale).toBe(false);
  });

  test("marks stale and preserves warnings when leaderboard fetch fails", async () => {
    const trackedRepos: TrackedRepoConfig[] = [
      { owner: "elizaOS", repo: "eliza", label: "Eliza Core", includeInEcosystemFactor: true },
    ];

    const mockFetch: MockFetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.endsWith("/api/index.json")) {
        return htmlResponse("index down", 500);
      }

      return htmlResponse("error", 500);
    };

    const snapshot = await fetchElizaSnapshot({ trackedRepos, fetchImpl: mockFetch, retries: 0, timeoutMs: 1_000 });

    expect(snapshot.periods.lifetime).toBeNull();
    expect(snapshot.status.isStale).toBe(true);
    expect(snapshot.status.warnings.length).toBeGreaterThan(0);
  });
});
