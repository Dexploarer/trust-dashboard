#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  DEFAULT_CONFIG,
  computeScoreHistory,
  computeTrustScore,
  getTier,
  type EventType,
} from "../src/lib/scoring-engine";
import { buildContributorHistories, fetchClosedPRs, mapPRToTrustEvent } from "../src/lib/github-data";
import { computeBadges, type BadgeInput } from "../src/lib/badges";
import {
  buildCoAuthorStats,
  deriveLoginFromEmail,
  emptyCoAuthorStats,
  extractCoAuthorsFromCommitMessage,
  isLikelyGitHubUsername,
  type CoAuthorSeed,
  type CoAuthorStats,
} from "../src/lib/coauthor-network";
import { computeLevelStats, computeTagXp, determineCharacterClass, isAgent } from "../src/lib/levels";
import ecosystemRepoConfig from "../src/config/ecosystem-repos.json";
import type { TrackedRepoConfig } from "../src/lib/ecosystem-types";
import { buildApiArtifacts, buildCombinedLeaderboardData, buildOpenApiSpec, mergeCrossNetworkIntoMilady } from "../src/lib/eliza-effect-scoring";
import { emptyElizaSnapshot, fetchElizaSnapshot } from "../src/lib/eliza-ingestion";

const OWNER = "milady-ai";
const REPO = "milaidy";
const GITHUB_API = "https://api.github.com";

type TierDistribution = {
  legendary: number;
  trusted: number;
  established: number;
  contributing: number;
  probationary: number;
  untested: number;
  restricted: number;
};

function emptyTierDistribution(): TierDistribution {
  return { legendary: 0, trusted: 0, established: 0, contributing: 0, probationary: 0, untested: 0, restricted: 0 };
}

function computeCurrentStreak(events: { type: EventType }[]): { type: "approve" | "negative" | null; length: number } {
  let type: "approve" | "negative" | null = null;
  let length = 0;

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const normalized: "approve" | "negative" | null =
      event.type === "approve" ? "approve" : event.type === "reject" || event.type === "close" ? "negative" : null;

    if (!normalized) continue;
    if (!type) { type = normalized; length = 1; continue; }
    if (type === normalized) { length++; } else { break; }
  }

  return { type, length };
}

// --- GitHub API helpers ---

function getHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "milaidy-trust-dashboard",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, { headers: getHeaders(token) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status} for ${url}: ${text}`);
  }
  return (await res.json()) as T;
}

interface GitHubIssue {
  number: number;
  user: { login: string; avatar_url?: string };
  labels: Array<{ name: string }>;
  state: string;
  pull_request?: unknown;
  created_at: string;
  closed_at: string | null;
}

interface GitHubComment {
  user: { login: string };
  created_at: string;
  issue_url?: string;
}

interface GitHubPullCommit {
  author: { login: string } | null;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
    };
  };
}

interface EcosystemRepoConfigFile {
  version?: string;
  trackedRepos?: TrackedRepoConfig[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeTrackedRepos(input: unknown): TrackedRepoConfig[] {
  const config = input as EcosystemRepoConfigFile;
  const repos = Array.isArray(config?.trackedRepos) ? config.trackedRepos : [];

  return repos
    .map((repo) => ({
      owner: String(repo.owner ?? "").trim(),
      repo: String(repo.repo ?? "").trim(),
      label: String(repo.label ?? `${repo.owner}/${repo.repo}`).trim(),
      includeInEcosystemFactor: Boolean(repo.includeInEcosystemFactor),
    }))
    .filter((repo) => repo.owner.length > 0 && repo.repo.length > 0);
}

function normalizeLogin(login: string): string | null {
  const trimmed = login.trim();
  if (!trimmed || !isLikelyGitHubUsername(trimmed)) return null;
  return trimmed;
}

function canonicalizeLogin(
  login: string,
  canonicalByLower: Map<string, string>,
): string | null {
  const normalized = normalizeLogin(login);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  const existing = canonicalByLower.get(lower);
  if (existing) return existing;
  canonicalByLower.set(lower, normalized);
  return normalized;
}

function resolveIdentityLogin(
  name: string | null | undefined,
  email: string | null | undefined,
  loginByEmail: Map<string, string>,
  loginByName: Map<string, string>,
  canonicalByLower: Map<string, string>,
): string | null {
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    const fromEmailMap = loginByEmail.get(normalizedEmail);
    if (fromEmailMap) return fromEmailMap;

    const fromEmailDerived = deriveLoginFromEmail(normalizedEmail);
    if (fromEmailDerived) return canonicalizeLogin(fromEmailDerived, canonicalByLower);
  }

  const normalizedName = name?.trim().toLowerCase();
  if (normalizedName) {
    const fromNameMap = loginByName.get(normalizedName);
    if (fromNameMap) return fromNameMap;

    const fromName = canonicalizeLogin(name!, canonicalByLower);
    if (fromName) return fromName;
  }

  return null;
}

function bindIdentity(
  login: string,
  name: string | null | undefined,
  email: string | null | undefined,
  loginByEmail: Map<string, string>,
  loginByName: Map<string, string>,
  canonicalByLower: Map<string, string>,
): void {
  const canonical = canonicalizeLogin(login, canonicalByLower);
  if (!canonical) return;

  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedName = name?.trim().toLowerCase();

  if (normalizedEmail) loginByEmail.set(normalizedEmail, canonical);
  if (normalizedName) loginByName.set(normalizedName, canonical);
}

async function fetchIssues(token?: string): Promise<GitHubIssue[]> {
  const all: GitHubIssue[] = [];
  const delayMs = token ? 0 : 100;
  let page = 1;
  while (true) {
    const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/issues?state=all&per_page=100&page=${page}`;
    const items = await fetchJson<GitHubIssue[]>(url, token);
    if (items.length === 0) break;
    // Filter out PRs (GitHub lists PRs under /issues too)
    all.push(...items.filter((i) => !i.pull_request));
    if (items.length < 100) break;
    page++;
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
  return all;
}

async function fetchIssueComments(token?: string): Promise<Map<string, number>> {
  const commentCounts = new Map<string, number>();
  const delayMs = token ? 0 : 100;
  let page = 1;
  while (true) {
    const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/issues/comments?per_page=100&page=${page}`;
    const comments = await fetchJson<GitHubComment[]>(url, token);
    if (comments.length === 0) break;
    for (const comment of comments) {
      const login = comment.user?.login;
      if (!login) continue;
      commentCounts.set(login, (commentCounts.get(login) ?? 0) + 1);
    }
    if (comments.length < 100) break;
    page++;
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
  return commentCounts;
}

function buildReviewCountsByUser(
  prs: Array<{
    reviews: Array<{ user?: { login?: string } | null }>;
  }>,
): Map<string, number> {
  const reviewCounts = new Map<string, number>();
  for (const pr of prs) {
    for (const review of pr.reviews) {
      const login = review.user?.login;
      if (!login) continue;
      reviewCounts.set(login, (reviewCounts.get(login) ?? 0) + 1);
    }
  }
  return reviewCounts;
}

async function fetchPullCommits(prNumber: number, token?: string): Promise<GitHubPullCommit[]> {
  const commits: GitHubPullCommit[] = [];
  let page = 1;

  while (true) {
    const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/pulls/${prNumber}/commits?per_page=100&page=${page}`;
    const pageCommits = await fetchJson<GitHubPullCommit[]>(url, token);
    if (pageCommits.length === 0) break;
    commits.push(...pageCommits);
    if (pageCommits.length < 100) break;
    page++;
  }

  return commits;
}

async function fetchCoAuthorSeeds(prNumbers: number[], token?: string): Promise<CoAuthorSeed[]> {
  const seeds: CoAuthorSeed[] = [];
  const loginByEmail = new Map<string, string>();
  const loginByName = new Map<string, string>();
  const canonicalByLower = new Map<string, string>();
  const delayMs = token ? 0 : 80;

  for (const prNum of prNumbers) {
    let commits: GitHubPullCommit[] = [];
    try {
      commits = await fetchPullCommits(prNum, token);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Skipping co-author parsing for PR #${prNum}: ${message}`);
      await sleep(50);
      continue;
    }

    for (const commit of commits) {
      const commitAuthor = commit.author?.login
        ? canonicalizeLogin(commit.author.login, canonicalByLower)
        : resolveIdentityLogin(
          commit.commit.author?.name,
          commit.commit.author?.email,
          loginByEmail,
          loginByName,
          canonicalByLower,
        );

      if (!commitAuthor) continue;

      bindIdentity(
        commitAuthor,
        commit.commit.author?.name,
        commit.commit.author?.email,
        loginByEmail,
        loginByName,
        canonicalByLower,
      );

      const coAuthors = extractCoAuthorsFromCommitMessage(commit.commit.message);
      if (coAuthors.length === 0) continue;

      const partners = new Set<string>();
      for (const coAuthor of coAuthors) {
        const partner = resolveIdentityLogin(
          coAuthor.name,
          coAuthor.email,
          loginByEmail,
          loginByName,
          canonicalByLower,
        );
        if (!partner || partner.toLowerCase() === commitAuthor.toLowerCase()) continue;

        bindIdentity(partner, coAuthor.name, coAuthor.email, loginByEmail, loginByName, canonicalByLower);
        partners.add(partner);
      }

      if (partners.size > 0) {
        seeds.push({
          primary: commitAuthor,
          partners: [...partners],
        });
      }
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return seeds;
}

function computeLongestStreak(events: Array<{ timestamp: number }>): number {
  if (events.length === 0) return 0;

  const days = new Set<string>();
  for (const e of events) {
    days.add(new Date(e.timestamp).toISOString().slice(0, 10));
  }

  const sortedDays = [...days].sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffMs = curr.getTime() - prev.getTime();
    if (diffMs <= 86400000) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

// --- Main ---

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const now = Date.now();

  // Fetch PRs
  console.log(`Fetching closed PRs for ${OWNER}/${REPO}...`);
  const prs = await fetchClosedPRs(OWNER, REPO, token);
  console.log(`Fetched ${prs.length} closed PRs`);

  // Fetch issues
  console.log("Fetching issues...");
  const issues = await fetchIssues(token);
  console.log(`Fetched ${issues.length} issues`);

  // Reuse review data already fetched with each PR.
  const prNumbers = prs.map((p) => p.number);
  const reviewCountsByUser = buildReviewCountsByUser(prs);
  console.log(`Counted ${[...reviewCountsByUser.values()].reduce((sum, count) => sum + count, 0)} reviews across ${reviewCountsByUser.size} reviewers`);

  // Fetch comments
  console.log("Fetching issue/PR comments...");
  const commentCounts = await fetchIssueComments(token);
  console.log(`Fetched comment data for ${commentCounts.size} users`);

  // Fetch co-author relationships from commit metadata
  if (!token) {
    console.warn("GITHUB_TOKEN is not set; co-author parsing may be incomplete due to API rate limits.");
  }
  console.log("Fetching commit co-author graph...");
  const coAuthorSeeds = await fetchCoAuthorSeeds(prNumbers, token);
  const coAuthorStatsByUser = buildCoAuthorStats(coAuthorSeeds, isAgent);
  console.log(`Parsed ${coAuthorSeeds.length} co-author commit relations across ${coAuthorStatsByUser.size} contributors`);

  // Build contributor events from PRs
  const events = prs
    .map((pr) => mapPRToTrustEvent(pr))
    .filter((event): event is NonNullable<typeof event> => event !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const { histories, avatars } = buildContributorHistories(events);

  // Build per-user issue stats
  const issuesByUser = new Map<string, GitHubIssue[]>();
  for (const issue of issues) {
    const login = issue.user?.login;
    if (!login) continue;
    if (!issuesByUser.has(login)) issuesByUser.set(login, []);
    issuesByUser.get(login)!.push(issue);
  }

  // Collect all unique usernames
  const allUsernames = new Set<string>([
    ...Object.keys(histories),
    ...issuesByUser.keys(),
    ...reviewCountsByUser.keys(),
    ...commentCounts.keys(),
    ...coAuthorStatsByUser.keys(),
  ]);

  const contributors = [...allUsernames]
    .map((username) => {
      const history = histories[username] ?? { contributor: username, createdAt: now, events: [] };
      const result = computeTrustScore(history, DEFAULT_CONFIG, now);
      const tierInfo = getTier(result.score, DEFAULT_CONFIG);
      const userEvents = [...history.events].sort((a, b) => a.timestamp - b.timestamp);
      const scoreHistory = computeScoreHistory(history, DEFAULT_CONFIG, now);
      const currentStreak = computeCurrentStreak(userEvents);

      const totalApprovals = userEvents.filter((e) => e.type === "approve").length;
      const totalRejections = userEvents.filter((e) => e.type === "reject").length;
      const totalCloses = userEvents.filter((e) => e.type === "close").length;
      const totalSelfCloses = userEvents.filter((e) => e.type === "selfClose").length;
      const userIssues = issuesByUser.get(username) ?? [];
      const userReviewCount = reviewCountsByUser.get(username) ?? 0;
      const totalComments = commentCounts.get(username) ?? 0;
      const coAuthorStats: CoAuthorStats = coAuthorStatsByUser.get(username) ?? emptyCoAuthorStats();

      const firstSeenAt = userEvents[0]
        ? new Date(userEvents[0].timestamp).toISOString()
        : new Date(history.createdAt).toISOString();
      const lastEventAt = userEvents.at(-1)
        ? new Date(userEvents.at(-1)!.timestamp).toISOString()
        : null;

      // Compute tag XP from PR labels
      const tagEvents = userEvents.map((e) => ({
        labels: e.labels,
        weight: e.type === "approve" ? 10 : e.type === "reject" ? 2 : 1,
      }));
      // Add issue labels to tag XP
      for (const issue of userIssues) {
        tagEvents.push({
          labels: issue.labels.map((l) => l.name),
          weight: issue.state === "closed" ? 5 : 2,
        });
      }
      const tagXp = computeTagXp(tagEvents);
      const levelStats = computeLevelStats(tagXp);

      // Compute badges
      const bugsClosed = userIssues.filter(
        (i) => i.state === "closed" && i.labels.some((l) => l.name === "bug" || l.name === "bugfix"),
      ).length;

      const longestStreak = computeLongestStreak([
        ...userEvents.map((e) => ({ timestamp: e.timestamp })),
        ...userIssues.map((i) => ({ timestamp: Date.parse(i.created_at) })),
      ]);

      const badgeInput: BadgeInput = {
        mergedPRs: totalApprovals,
        bugsClosed,
        reviewsGiven: userReviewCount,
        longestStreak,
        totalLevel: levelStats.totalLevel,
      };
      const badges = computeBadges(badgeInput);

      // Determine character class
      const agentFlag = isAgent(username);
      const characterClass = determineCharacterClass(tagXp, agentFlag);

      return {
        username,
        avatarUrl: avatars[username] ?? `https://github.com/${username}.png`,
        trustScore: result.score,
        tier: tierInfo.label,
        tierInfo,
        breakdown: result.breakdown,
        currentStreak,
        currentStreakType: currentStreak.type === "approve" ? "approve" : currentStreak.type ? "negative" : null,
        currentStreakLength: currentStreak.length,
        totalApprovals,
        totalRejections,
        totalCloses,
        totalSelfCloses,
        totalReviews: userReviewCount,
        totalIssues: userIssues.length,
        totalComments,
        isAgent: agentFlag,
        characterClass: characterClass.id,
        badges,
        tags: levelStats.tags,
        totalLevel: levelStats.totalLevel,
        totalXp: levelStats.totalXp,
        coAuthorStats,
        lastEventAt,
        firstSeenAt,
        walletAddress: null,
        autoMergeEligible: tierInfo.label === "legendary",
        events: userEvents,
        scoreHistory,
        warnings: result.warnings,
      };
    })
    .sort((a, b) => b.trustScore - a.trustScore);

  const tierDistribution = emptyTierDistribution();
  for (const c of contributors) {
    tierDistribution[c.tier]++;
  }

  const avgScore =
    contributors.length > 0
      ? Number((contributors.reduce((sum, c) => sum + c.trustScore, 0) / contributors.length).toFixed(2))
      : 0;

  const totalCoauthoredCommits = contributors.reduce(
    (sum, contributor) => sum + contributor.coAuthorStats.totalCoauthoredCommits,
    0,
  );
  const totalCoauthorPairs = contributors.reduce(
    (sum, contributor) => sum + contributor.coAuthorStats.totalCoauthorPartners,
    0,
  );

  const generatedAt = new Date(now).toISOString();
  const trackedRepos = normalizeTrackedRepos(ecosystemRepoConfig);

  console.log("Fetching Eliza leaderboard snapshots...");
  let elizaSnapshot = emptyElizaSnapshot(new Date(now));
  try {
    elizaSnapshot = await fetchElizaSnapshot({
      trackedRepos,
      now: new Date(now),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    elizaSnapshot.status.warnings.push(`Eliza snapshot fetch failed: ${message}`);
  }

  const combined = buildCombinedLeaderboardData({
    contributors,
    snapshot: elizaSnapshot,
    trackedRepos,
    generatedAt,
  });
  const contributorsWithCrossNetwork = mergeCrossNetworkIntoMilady(contributors, combined);

  const payload = {
    generatedAt,
    repoFullName: `${OWNER}/${REPO}`,
    contributors: contributorsWithCrossNetwork,
    stats: {
      totalContributors: contributorsWithCrossNetwork.length,
      totalEvents: events.length,
      totalIssues: issues.length,
      totalReviews: [...reviewCountsByUser.values()].reduce((sum, count) => sum + count, 0),
      totalCoauthoredCommits,
      totalCoauthorPairs,
      tierDistribution,
      avgScore,
    },
  };

  const outDir = join(process.cwd(), "src", "data");
  const publicApiDir = join(process.cwd(), "public", "api");

  const outFile = join(outDir, "trust-scores.json");
  const outElizaSnapshot = join(outDir, "eliza-snapshot.json");
  const outCombined = join(outDir, "combined-leaderboard.json");

  await writeJsonFile(outFile, payload);
  await writeJsonFile(outElizaSnapshot, elizaSnapshot);
  await writeJsonFile(outCombined, combined);

  const artifacts = buildApiArtifacts(combined);
  await writeJsonFile(join(publicApiDir, "index.json"), artifacts.index);
  await writeJsonFile(join(publicApiDir, "leaderboards", "milady", "lifetime.json"), artifacts.miladyLifetime);
  await writeJsonFile(join(publicApiDir, "leaderboards", "eliza", "lifetime.json"), artifacts.elizaLifetime);
  await writeJsonFile(join(publicApiDir, "leaderboards", "eliza", "weekly.json"), artifacts.elizaWeekly);
  await writeJsonFile(join(publicApiDir, "leaderboards", "eliza", "monthly.json"), artifacts.elizaMonthly);
  await writeJsonFile(join(publicApiDir, "leaderboards", "eliza-effect", "lifetime.json"), artifacts.elizaEffectLifetime);
  await writeJsonFile(join(publicApiDir, "repos", "index.json"), artifacts.repos);

  for (const [username, profile] of Object.entries(artifacts.profiles)) {
    await writeJsonFile(join(publicApiDir, "contributors", username, "profile.json"), profile);
  }

  const openApiSpec = buildOpenApiSpec(generatedAt);
  await writeJsonFile(join(process.cwd(), "public", "openapi.json"), openApiSpec);

  console.log(`Wrote ${contributorsWithCrossNetwork.length} contributors to ${outFile}`);
  console.log(
    `  - ${issues.length} issues, ${reviewCountsByUser.size} reviewers, ${commentCounts.size} commenters, ${coAuthorSeeds.length} co-authored commits`,
  );
  console.log(`Wrote Eliza snapshot to ${outElizaSnapshot}`);
  console.log(`Wrote combined leaderboard to ${outCombined}`);
  console.log(`Wrote static API artifacts to ${publicApiDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
