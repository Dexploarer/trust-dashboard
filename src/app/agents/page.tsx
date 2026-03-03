"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveTrustData } from "@/lib/use-live-trust-data";
import { TierBadge } from "@/components/tier-badge";
import { formatRelativeTime } from "@/lib/utils";

type SortKey = "trustScore" | "level" | "xp" | "recent" | "username";

function normalizeTimestamp(ts: number): number {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("trustScore");
  const { contributors: allContributors, isLoading, isRefreshing, nextRefreshIn } = useLiveTrustData();

  const agents = useMemo(() => {
    const filtered = allContributors.filter((contributor) => contributor.isAgent);
    const searchLower = search.trim().toLowerCase();

    const searchFiltered = searchLower
      ? filtered.filter((contributor) => contributor.username.toLowerCase().includes(searchLower))
      : filtered;

    return searchFiltered.sort((a, b) => {
      switch (sortBy) {
        case "level":
          return b.totalLevel - a.totalLevel;
        case "xp":
          return b.totalXp - a.totalXp;
        case "recent":
          return new Date(b.lastEventAt || 0).getTime() - new Date(a.lastEventAt || 0).getTime();
        case "username":
          return a.username.localeCompare(b.username);
        case "trustScore":
        default:
          return b.trustScore - a.trustScore;
      }
    });
  }, [allContributors, search, sortBy]);

  const metrics = useMemo(() => {
    if (agents.length === 0) {
      return { avgTrust: 0, trustedPlus: 0, events30d: 0, totalReviews: 0, coauthored: 0 };
    }

    const avgTrust = agents.reduce((sum, agent) => sum + agent.trustScore, 0) / agents.length;
    const trustedPlus = agents.filter((agent) => agent.tier.label === "trusted" || agent.tier.label === "legendary").length;
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const events30d = agents.reduce(
      (sum, agent) => sum + agent.events.filter((event) => normalizeTimestamp(event.timestamp) >= monthAgo).length,
      0,
    );
    const totalReviews = agents.reduce((sum, agent) => sum + (agent.totalReviews ?? 0), 0);
    const coauthored = agents.reduce((sum, agent) => sum + agent.coAuthorStats.totalCoauthoredCommits, 0);

    return { avgTrust, trustedPlus, events30d, totalReviews, coauthored };
  }, [agents]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <header className="text-center space-y-2">
        <div className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          {isLoading ? "Loading agents..." : isRefreshing ? "Refreshing agents..." : `Live agents · refresh ${nextRefreshIn}s`}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Agent Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Automated contributors scored with the same trust model, badges, and XP levels.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Agents" value={agents.length.toLocaleString()} />
        <MetricCard label="Avg Trust" value={metrics.avgTrust.toFixed(1)} />
        <MetricCard label="Trusted+" value={metrics.trustedPlus.toLocaleString()} />
        <MetricCard label="30d Events" value={metrics.events30d.toLocaleString()} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            aria-label="Sort agents"
          >
            <option value="trustScore">Sort: Trust</option>
            <option value="level">Sort: Level</option>
            <option value="xp">Sort: XP</option>
            <option value="recent">Sort: Recent</option>
            <option value="username">Sort: Username</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{agents.length} agent{agents.length !== 1 ? "s" : ""}</span>
          <span>•</span>
          <span>{metrics.totalReviews.toLocaleString()} reviews</span>
          <span>•</span>
          <span>{metrics.coauthored.toLocaleString()} co-auth commits</span>
          <span>•</span>
          <span>Top trust: {agents[0]?.trustScore.toFixed(1) ?? "—"}</span>
        </div>
      </section>

      {agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <h3 className="text-lg font-semibold mb-1">No agents found</h3>
          <p className="text-sm text-muted-foreground">
            Agent usernames are detected by patterns like `[bot]`, `-bot`, and known bot accounts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent, index) => (
            <Link
              key={agent.username}
              href={`/contributor/${agent.username}`}
              className="block rounded-2xl border border-border bg-card px-4 py-3 card-hover"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 shrink-0 text-sm font-mono text-muted-foreground">#{index + 1}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://github.com/${agent.username}.png`}
                  alt={agent.username}
                  className="h-11 w-11 rounded-full border border-border bg-muted"
                  loading="lazy"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{agent.username}</span>
                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      bot
                    </span>
                    <TierBadge tier={agent.tier} size="sm" />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>Lv {agent.totalLevel}</span>
                    <span>•</span>
                    <span>{agent.totalXp.toLocaleString()} XP</span>
                    <span>•</span>
                    <span>{agent.events.length.toLocaleString()} events</span>
                    {agent.coAuthorStats.totalCoauthoredCommits > 0 ? (
                      <>
                        <span>•</span>
                        <span>{agent.coAuthorStats.totalCoauthoredCommits.toLocaleString()} co-authored</span>
                      </>
                    ) : null}
                  </div>
                  {agent.coAuthorStats.uses[0] ? (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Uses {agent.coAuthorStats.uses[0].username} x{agent.coAuthorStats.uses[0].count}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-base sm:text-xl font-semibold font-mono" style={{ color: agent.tier.color }}>
                    {agent.trustScore.toFixed(1)}
                  </div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground">
                    Last active {formatRelativeTime(agent.lastEventAt)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
      <div className="text-xl font-semibold font-mono tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
