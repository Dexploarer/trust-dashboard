"use client";

import { useMemo, useState } from "react";
import { ActivityFeed } from "@/components/activity-feed";
import { Leaderboard } from "@/components/leaderboard";
import { StatsBar } from "@/components/stats-bar";
import { useLiveTrustData } from "@/lib/use-live-trust-data";
import { TIERS, TrustTier, getApprovalRate, getTotalPRs } from "@/lib/trust-scoring";
import { formatRelativeTime } from "@/lib/utils";

type SortKey = "trustScore" | "recent" | "streak" | "approvalRate" | "prCount" | "username" | "level" | "xp";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "trustScore", label: "Trust Score" },
  { key: "level", label: "Total Level" },
  { key: "xp", label: "Total XP" },
  { key: "recent", label: "Recent Activity" },
  { key: "streak", label: "Streak Length" },
  { key: "approvalRate", label: "Approval Rate" },
  { key: "prCount", label: "PR Count" },
  { key: "username", label: "Username" },
];

function isActiveInLast30Days(lastEventAt: string | null): boolean {
  if (!lastEventAt) return false;
  const ts = Date.parse(lastEventAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 30 * 24 * 60 * 60 * 1000;
}

function normalizeTimestamp(ts: number): number {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [selectedTiers, setSelectedTiers] = useState<TrustTier[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("trustScore");
  const [showHumansOnly, setShowHumansOnly] = useState(false);
  const {
    contributors: allContributors,
    stats,
    generatedAt,
    isLoading,
    isRefreshing,
    refreshError,
    nextRefreshIn,
    lastUpdatedAt,
  } = useLiveTrustData();

  const filteredSorted = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    const filtered = allContributors.filter((contributor) => {
      const tierPass = selectedTiers.length === 0 || selectedTiers.includes(contributor.tier.label);
      const searchPass = searchLower.length === 0 || contributor.username.toLowerCase().includes(searchLower);
      const agentPass = !showHumansOnly || !contributor.isAgent;
      return tierPass && searchPass && agentPass;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "level":
          return b.totalLevel - a.totalLevel;
        case "xp":
          return b.totalXp - a.totalXp;
        case "recent":
          return new Date(b.lastEventAt || 0).getTime() - new Date(a.lastEventAt || 0).getTime();
        case "streak":
          return b.currentStreak.length - a.currentStreak.length;
        case "approvalRate":
          return getApprovalRate(b) - getApprovalRate(a);
        case "prCount":
          return getTotalPRs(b) - getTotalPRs(a);
        case "username":
          return a.username.localeCompare(b.username);
        case "trustScore":
        default:
          return b.trustScore - a.trustScore;
      }
    });
  }, [allContributors, search, selectedTiers, sortBy, showHumansOnly]);

  const activeContributors = useMemo(
    () => allContributors.filter((contributor) => isActiveInLast30Days(contributor.lastEventAt)).length,
    [allContributors],
  );

  const metrics = useMemo(() => {
    const avgScore = allContributors.length
      ? allContributors.reduce((sum, contributor) => sum + contributor.trustScore, 0) / allContributors.length
      : 0;
    const trustedPlus = allContributors.filter(
      (contributor) => contributor.tier.label === "trusted" || contributor.tier.label === "legendary",
    ).length;
    const autoMerge = allContributors.filter((contributor) => contributor.autoMergeEligible).length;
    const agentCount = allContributors.filter((contributor) => contributor.isAgent).length;
    const reviews = allContributors.reduce((sum, contributor) => sum + (contributor.totalReviews ?? 0), 0);
    const issues = allContributors.reduce((sum, contributor) => sum + (contributor.totalIssues ?? 0), 0);
    const comments = allContributors.reduce((sum, contributor) => sum + (contributor.totalComments ?? 0), 0);
    const coauthored = allContributors.reduce(
      (sum, contributor) => sum + contributor.coAuthorStats.totalCoauthoredCommits,
      0,
    );
    const events24h = allContributors.reduce(
      (sum, contributor) =>
        sum +
        contributor.events.filter((event) => Date.now() - normalizeTimestamp(event.timestamp) <= 24 * 60 * 60 * 1000).length,
      0,
    );

    return { avgScore, trustedPlus, autoMerge, agentCount, reviews, issues, comments, coauthored, events24h };
  }, [allContributors]);

  const spotlight = useMemo(() => {
    if (allContributors.length === 0) {
      return {
        topMonthly: null as typeof allContributors[number] | null,
        topStreak: null as typeof allContributors[number] | null,
        topTrust: null as typeof allContributors[number] | null,
      };
    }

    const byMonthly = [...allContributors].sort((a, b) => {
      const aCount = a.events.filter((event) => Date.now() - normalizeTimestamp(event.timestamp) <= 30 * 24 * 60 * 60 * 1000).length;
      const bCount = b.events.filter((event) => Date.now() - normalizeTimestamp(event.timestamp) <= 30 * 24 * 60 * 60 * 1000).length;
      return bCount - aCount;
    });
    const byStreak = [...allContributors].sort((a, b) => b.currentStreak.length - a.currentStreak.length);
    const byTrust = [...allContributors].sort((a, b) => b.trustScore - a.trustScore);

    return { topMonthly: byMonthly[0], topStreak: byStreak[0], topTrust: byTrust[0] };
  }, [allContributors]);

  const liveStatusLabel = isLoading
    ? "Live · Loading rankings..."
    : isRefreshing
      ? "Live · Refreshing rankings..."
      : "Live · Refreshes every 60s";

  const toggleTier = (tier: TrustTier) => {
    setSelectedTiers((prev) => (prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]));
  };

  return (
    <div className="min-h-screen bg-zinc-50/70 dark:bg-zinc-950/40">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        <header className="mb-2 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            {liveStatusLabel}
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Contributor Leaderboard</h1>
          <a
            href="https://github.com/milady-ai/milaidy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-violet-600 dark:text-zinc-400 dark:hover:text-violet-400"
          >
            milady-ai/milaidy ↗
          </a>
        </header>

        {!isLoading ? (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Contributors" value={allContributors.length.toLocaleString()} />
            <StatTile label="Total Events" value={stats.totalEvents.toLocaleString()} />
            <StatTile label="Active (30d)" value={activeContributors.toLocaleString()} />
            <StatTile label="Avg Trust" value={metrics.avgScore.toFixed(1)} />
            <StatTile label="Trusted+" value={metrics.trustedPlus.toLocaleString()} />
            <StatTile label="Auto-Merge" value={metrics.autoMerge.toLocaleString()} />
          </section>
        ) : null}

        {!isLoading ? (
          <section className="rounded-2xl border border-zinc-200/80 bg-white/90 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/80">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <MiniMetric label="Agents" value={metrics.agentCount.toLocaleString()} />
              <MiniMetric label="24h Events" value={metrics.events24h.toLocaleString()} />
              <MiniMetric label="Reviews" value={metrics.reviews.toLocaleString()} />
              <MiniMetric label="Comments" value={(metrics.comments + metrics.issues).toLocaleString()} />
              <MiniMetric label="Co-Authored" value={metrics.coauthored.toLocaleString()} />
            </div>
          </section>
        ) : null}

        {!isLoading ? (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InsightCard
              title="Top 30d Activity"
              value={spotlight.topMonthly ? `@${spotlight.topMonthly.username}` : "—"}
              subtitle={spotlight.topMonthly ? `${spotlight.topMonthly.events.length} total events` : "No contributor data"}
            />
            <InsightCard
              title="Longest Streak"
              value={spotlight.topStreak ? `@${spotlight.topStreak.username}` : "—"}
              subtitle={
                spotlight.topStreak
                  ? `${spotlight.topStreak.currentStreak.length} ${spotlight.topStreak.currentStreak.type ?? "event"} streak`
                  : "No contributor data"
              }
            />
            <InsightCard
              title="Highest Trust"
              value={spotlight.topTrust ? `@${spotlight.topTrust.username}` : "—"}
              subtitle={spotlight.topTrust ? `${spotlight.topTrust.trustScore.toFixed(1)} score` : "No contributor data"}
            />
          </section>
        ) : null}

        {refreshError ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            Live refresh failed. Showing latest bundled snapshot.
          </section>
        ) : null}

        <Leaderboard contributors={filteredSorted} />

        <details className="rounded-2xl border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/70">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-700 marker:hidden dark:text-zinc-200">
            Advanced filters & activity
          </summary>
          <div className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search username..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/60"
              />

              <div className="flex items-center gap-2">
                <label htmlFor="sortBy" className="text-xs text-muted-foreground">
                  Sort
                </label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="rounded-xl border border-border bg-background px-2.5 py-2 text-sm"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowHumansOnly((v) => !v)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  showHumansOnly
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-border bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {showHumansOnly ? "Humans only" : "All contributors"}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {TIERS.map((tier) => {
                const active = selectedTiers.includes(tier.label);
                return (
                  <button
                    key={tier.label}
                    type="button"
                    onClick={() => toggleTier(tier.label)}
                    className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                      active
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-border bg-muted/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tier.icon} {tier.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {filteredSorted.length} of {allContributors.length} contributors
              </span>
              {selectedTiers.length > 0 ? <span>• tiers: {selectedTiers.join(", ")}</span> : null}
              <span>• sort: {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}</span>
              {search ? <span>• search: &quot;{search}&quot;</span> : null}
              {showHumansOnly ? <span>• humans only</span> : null}
            </div>

            <StatsBar contributors={allContributors} stats={stats} generatedAt={generatedAt} />
            <ActivityFeed contributors={allContributors} />
          </div>
        </details>

        <footer className="mt-8 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-600">
          <span>Updated {formatRelativeTime(lastUpdatedAt)}</span>
          <span>Next refresh in {nextRefreshIn}s</span>
        </footer>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/95 px-4 py-3 text-center shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{label}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/80 px-3 py-2 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</div>
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

function InsightCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/95 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</div>
      <div className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</div>
    </div>
  );
}
