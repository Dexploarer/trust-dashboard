import type { TrackedRepoConfig } from "./ecosystem-types";
import type {
  ElizaApiIndex,
  ElizaLeaderboardEntry,
  ElizaLeaderboardResponse,
  ElizaLeaderboardSnapshot,
  ElizaPeriod,
  ElizaRepoSummaryResponse,
  ElizaRepoSummarySnapshot,
} from "./eliza-types";

const ELIZA_BASE_URL = "https://elizaos.github.io";
const LEADERBOARD_ENDPOINTS: Record<ElizaPeriod, string> = {
  lifetime: `${ELIZA_BASE_URL}/api/leaderboard-lifetime.json`,
  weekly: `${ELIZA_BASE_URL}/api/leaderboard-weekly.json`,
  monthly: `${ELIZA_BASE_URL}/api/leaderboard-monthly.json`,
};
const INDEX_ENDPOINT = `${ELIZA_BASE_URL}/api/index.json`;

type FetchLike = typeof fetch;

class HttpError extends Error {
  status: number;
  url: string;

  constructor(url: string, status: number, message: string) {
    super(message);
    this.status = status;
    this.url = url;
  }
}

interface FetchWithRetryOptions {
  timeoutMs: number;
  retries: number;
  fetchImpl: FetchLike;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toSafeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeLeaderboardEntry(entry: unknown, index: number): ElizaLeaderboardEntry | null {
  if (!entry || typeof entry !== "object") return null;

  const candidate = entry as Record<string, unknown>;
  const username = toSafeString(candidate.username).trim();
  if (!username) return null;

  const rank = Math.max(1, Math.trunc(toFiniteNumber(candidate.rank, index + 1)));
  const score = toFiniteNumber(candidate.score, 0);
  const avatarFromPayload = toSafeString(candidate.avatarUrl).trim();

  return {
    rank,
    username,
    avatarUrl: avatarFromPayload || `https://github.com/${username}.png`,
    characterClass: toSafeString(candidate.characterClass) || undefined,
    tier: toSafeString(candidate.tier) || undefined,
    score,
    prScore: toFiniteNumber(candidate.prScore, 0),
    issueScore: toFiniteNumber(candidate.issueScore, 0),
    reviewScore: toFiniteNumber(candidate.reviewScore, 0),
    commentScore: toFiniteNumber(candidate.commentScore, 0),
    percentile: Number.isFinite(toFiniteNumber(candidate.percentile, Number.NaN))
      ? toFiniteNumber(candidate.percentile)
      : undefined,
    focusAreas: Array.isArray(candidate.focusAreas)
      ? (candidate.focusAreas as ElizaLeaderboardEntry["focusAreas"])
      : undefined,
    achievements: Array.isArray(candidate.achievements)
      ? (candidate.achievements as ElizaLeaderboardEntry["achievements"])
      : undefined,
    wallets:
      candidate.wallets && typeof candidate.wallets === "object"
        ? (candidate.wallets as ElizaLeaderboardEntry["wallets"])
        : undefined,
  };
}

function normalizeLeaderboardPayload(payload: unknown, period: ElizaPeriod, nowIso: string): ElizaLeaderboardResponse {
  const candidate = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const entries = Array.isArray(candidate.leaderboard)
    ? candidate.leaderboard
      .map((entry, index) => normalizeLeaderboardEntry(entry, index))
      .filter((entry): entry is ElizaLeaderboardEntry => Boolean(entry))
    : [];

  const sorted = [...entries].sort((a, b) => a.rank - b.rank || b.score - a.score || a.username.localeCompare(b.username));

  return {
    version: toSafeString(candidate.version, "1.0"),
    period,
    generatedAt: toSafeString(candidate.generatedAt, nowIso),
    startDate: toSafeString(candidate.startDate) || undefined,
    endDate: toSafeString(candidate.endDate) || undefined,
    totalUsers: Math.max(sorted.length, Math.trunc(toFiniteNumber(candidate.totalUsers, sorted.length))),
    leaderboard: sorted,
  };
}

function normalizeIndexPayload(payload: unknown): ElizaApiIndex | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;

  return {
    version: toSafeString(candidate.version, "1.0"),
    baseUrl: toSafeString(candidate.baseUrl) || undefined,
    documentation: toSafeString(candidate.documentation) || undefined,
    openapi: toSafeString(candidate.openapi) || undefined,
    endpoints:
      candidate.endpoints && typeof candidate.endpoints === "object"
        ? (candidate.endpoints as ElizaApiIndex["endpoints"])
        : undefined,
  };
}

async function fetchJsonWithRetry<T>(url: string, options: FetchWithRetryOptions): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await options.fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "milaidy-trust-dashboard",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyPreview = (await response.text()).slice(0, 256);
        throw new HttpError(url, response.status, `HTTP ${response.status} for ${url}: ${bodyPreview}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isNotFound = error instanceof HttpError && error.status === 404;
      const isLastAttempt = attempt >= options.retries;

      if (isNotFound || isLastAttempt) {
        throw lastError;
      }

      await sleep(200 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

export function toElizaRepoId(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase().replace("/", "_");
}

function makeRepoSummaryUrl(repoId: string): string {
  return `${ELIZA_BASE_URL}/api/summaries/repos/${encodeURIComponent(repoId)}/week/latest.json`;
}

export interface FetchElizaSnapshotOptions {
  trackedRepos: TrackedRepoConfig[];
  fetchImpl?: FetchLike;
  retries?: number;
  timeoutMs?: number;
  now?: Date;
}

interface SnapshotFetchState {
  fetchOptions: FetchWithRetryOptions;
  nowIso: string;
}

async function fetchLeaderboardPeriod(
  period: ElizaPeriod,
  state: SnapshotFetchState,
): Promise<{ period: ElizaPeriod; payload: ElizaLeaderboardResponse | null; warning?: string }> {
  const url = LEADERBOARD_ENDPOINTS[period];

  try {
    const raw = await fetchJsonWithRetry<unknown>(url, state.fetchOptions);
    return {
      period,
      payload: normalizeLeaderboardPayload(raw, period, state.nowIso),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      period,
      payload: null,
      warning: `Failed to fetch Eliza ${period} leaderboard: ${message}`,
    };
  }
}

async function fetchIndex(state: SnapshotFetchState): Promise<{ payload: ElizaApiIndex | null; warning?: string }> {
  try {
    const raw = await fetchJsonWithRetry<unknown>(INDEX_ENDPOINT, state.fetchOptions);
    return { payload: normalizeIndexPayload(raw) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      payload: null,
      warning: `Failed to fetch Eliza API index: ${message}`,
    };
  }
}

async function fetchRepoSummary(
  repo: TrackedRepoConfig,
  state: SnapshotFetchState,
): Promise<ElizaRepoSummarySnapshot> {
  const repoId = toElizaRepoId(repo.owner, repo.repo);
  const sourceUrl = makeRepoSummaryUrl(repoId);

  try {
    const raw = await fetchJsonWithRetry<unknown>(sourceUrl, state.fetchOptions);
    const normalizedRaw = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const response: ElizaRepoSummaryResponse = {
      version: toSafeString(normalizedRaw.version, "1.0"),
      type: toSafeString(normalizedRaw.type, "repository"),
      interval: toSafeString(normalizedRaw.interval, "week"),
      date: toSafeString(normalizedRaw.date, ""),
      generatedAt: toSafeString(normalizedRaw.generatedAt, state.nowIso),
      sourceLastUpdated: toSafeString(normalizedRaw.sourceLastUpdated) || undefined,
      entity:
        normalizedRaw.entity && typeof normalizedRaw.entity === "object"
          ? {
            repoId: toSafeString((normalizedRaw.entity as Record<string, unknown>).repoId) || undefined,
            owner: toSafeString((normalizedRaw.entity as Record<string, unknown>).owner) || undefined,
            repo: toSafeString((normalizedRaw.entity as Record<string, unknown>).repo) || undefined,
          }
          : undefined,
      contentFormat: toSafeString(normalizedRaw.contentFormat) || undefined,
      contentHash: toSafeString(normalizedRaw.contentHash) || undefined,
    };

    return {
      repoId,
      interval: "week",
      sourceUrl,
      fetchedAt: state.nowIso,
      status: "ok",
      response,
    };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return {
        repoId,
        interval: "week",
        sourceUrl,
        fetchedAt: state.nowIso,
        status: "missing",
        response: null,
        error: `Summary not published for ${repo.owner}/${repo.repo}`,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      repoId,
      interval: "week",
      sourceUrl,
      fetchedAt: state.nowIso,
      status: "error",
      response: null,
      error: message,
    };
  }
}

export async function fetchElizaSnapshot(options: FetchElizaSnapshotOptions): Promise<ElizaLeaderboardSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const nowIso = (options.now ?? new Date()).toISOString();

  const state: SnapshotFetchState = {
    fetchOptions: { fetchImpl, retries, timeoutMs },
    nowIso,
  };

  const [indexResult, leaderboardResults, repoSummaries] = await Promise.all([
    fetchIndex(state),
    Promise.all((Object.keys(LEADERBOARD_ENDPOINTS) as ElizaPeriod[]).map((period) => fetchLeaderboardPeriod(period, state))),
    Promise.all((options.trackedRepos ?? []).map((repo) => fetchRepoSummary(repo, state))),
  ]);

  const periodPayloads = leaderboardResults.reduce<Record<ElizaPeriod, ElizaLeaderboardResponse | null>>(
    (acc, result) => {
      acc[result.period] = result.payload;
      return acc;
    },
    { lifetime: null, weekly: null, monthly: null },
  );

  const warnings = [
    ...leaderboardResults.map((result) => result.warning).filter((warning): warning is string => Boolean(warning)),
    ...repoSummaries
      .map((summary) => summary.error)
      .filter((warning): warning is string => Boolean(warning)),
  ];

  if (indexResult.warning) {
    warnings.unshift(indexResult.warning);
  }

  const hasAllLeaderboards = Object.values(periodPayloads).every((payload) => payload !== null);

  return {
    version: "1.0",
    source: ELIZA_BASE_URL,
    generatedAt: periodPayloads.lifetime?.generatedAt ?? nowIso,
    fetchedAt: nowIso,
    index: indexResult.payload,
    periods: periodPayloads,
    repoSummaries,
    status: {
      isStale: !hasAllLeaderboards,
      warnings,
    },
  };
}

export function emptyElizaSnapshot(now: Date = new Date()): ElizaLeaderboardSnapshot {
  const nowIso = now.toISOString();

  return {
    version: "1.0",
    source: ELIZA_BASE_URL,
    generatedAt: nowIso,
    fetchedAt: nowIso,
    index: null,
    periods: {
      lifetime: null,
      weekly: null,
      monthly: null,
    },
    repoSummaries: [],
    status: {
      isStale: true,
      warnings: ["Eliza snapshot not generated yet"],
    },
  };
}
