import { createContributorState, type ContributorState, type EventType, type TrustEvent } from "./scoring-engine";

const GITHUB_API = "https://api.github.com";

interface GitHubUser {
  login: string;
  avatar_url?: string;
}

interface GitHubLabel {
  name: string;
}

interface PullListItem {
  number: number;
}

interface PullDetail {
  number: number;
  title: string;
  user: GitHubUser;
  merged_at: string | null;
  closed_at: string | null;
  additions: number;
  deletions: number;
  labels: GitHubLabel[];
  closed_by?: GitHubUser | null;
}

interface PullReview {
  state: string;
  body: string | null;
  user?: GitHubUser | null;
  submitted_at?: string | null;
}

export interface GitHubPullRequestData {
  number: number;
  title: string;
  userLogin: string;
  avatarUrl: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  labels: string[];
  reviews: PullReview[];
  closedByLogin: string | null;
}

export interface TrustEventWithMeta extends TrustEvent {
  contributor: string;
  avatarUrl: string;
  prTitle: string;
}

function getHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "milaidy-trust-dashboard",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status} for ${url}: ${text}`);
  }

  return (await res.json()) as T;
}

export async function fetchClosedPRs(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubPullRequestData[]> {
  const allPRs: GitHubPullRequestData[] = [];
  const delayMs = token ? 0 : 100;

  let page = 1;
  while (true) {
    const listUrl = `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=closed&per_page=100&page=${page}`;
    const pulls = await fetchJson<PullListItem[]>(listUrl, token);
    if (pulls.length === 0) break;

    for (const pr of pulls) {
      const detailUrl = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pr.number}`;
      const reviewsUrl = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pr.number}/reviews?per_page=100`;

      const [detail, reviews] = await Promise.all([
        fetchJson<PullDetail>(detailUrl, token),
        fetchJson<PullReview[]>(reviewsUrl, token),
      ]);

      allPRs.push({
        number: detail.number,
        title: detail.title,
        userLogin: detail.user.login,
        avatarUrl: detail.user.avatar_url ?? "https://github.com/ghost.png",
        mergedAt: detail.merged_at,
        closedAt: detail.closed_at,
        additions: detail.additions,
        deletions: detail.deletions,
        labels: detail.labels.map((l) => l.name),
        reviews,
        closedByLogin: detail.closed_by?.login ?? null,
      });

      // Keep unauthenticated mode conservative to avoid secondary rate limits.
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    if (pulls.length < 100) break;
    page++;
  }

  return allPRs;
}

function detectSeverityFromReviews(reviews: PullReview[]): TrustEvent["reviewSeverity"] {
  const bodies = reviews
    .map((r) => r.body ?? "")
    .join("\n")
    .toLowerCase();

  if (bodies.includes("[severity:critical]")) return "critical";
  if (bodies.includes("[severity:major]")) return "major";
  if (bodies.includes("[severity:minor]")) return "minor";
  if (bodies.includes("[severity:trivial]")) return "trivial";
  if (bodies.includes("[severity:normal]")) return "normal";
  return undefined;
}

export function mapPRToTrustEvent(pr: GitHubPullRequestData): TrustEventWithMeta | null {
  const hasRequestChanges = pr.reviews.some(
    (review) => review.state.toUpperCase() === "CHANGES_REQUESTED",
  );

  let type: EventType;
  if (pr.mergedAt) {
    type = "approve";
  } else if (hasRequestChanges) {
    type = "reject";
  } else {
    const closedByAuthor = pr.closedByLogin && pr.closedByLogin === pr.userLogin;
    type = closedByAuthor ? "selfClose" : "close";
  }

  const timestamp = Date.parse(pr.mergedAt ?? pr.closedAt ?? new Date().toISOString());
  const linesChanged = (pr.additions ?? 0) + (pr.deletions ?? 0);

  return {
    contributor: pr.userLogin,
    avatarUrl: pr.avatarUrl,
    prTitle: pr.title,
    type,
    timestamp,
    linesChanged,
    labels: pr.labels,
    reviewSeverity: type === "reject" ? detectSeverityFromReviews(pr.reviews) : undefined,
    prNumber: pr.number,
  };
}

export function buildContributorHistories(events: TrustEventWithMeta[]): {
  histories: Record<string, ContributorState>;
  avatars: Record<string, string>;
  eventMeta: Record<string, TrustEventWithMeta[]>;
} {
  const histories: Record<string, ContributorState> = {};
  const avatars: Record<string, string> = {};
  const eventMeta: Record<string, TrustEventWithMeta[]> = {};

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  for (const event of sorted) {
    const username = event.contributor;
    if (!histories[username]) {
      histories[username] = createContributorState(username);
      histories[username].createdAt = event.timestamp;
      avatars[username] = event.avatarUrl;
      eventMeta[username] = [];
    }

    histories[username].events.push({
      type: event.type,
      timestamp: event.timestamp,
      linesChanged: event.linesChanged,
      labels: event.labels,
      reviewSeverity: event.reviewSeverity,
      prNumber: event.prNumber,
    });

    eventMeta[username].push(event);
  }

  return { histories, avatars, eventMeta };
}
