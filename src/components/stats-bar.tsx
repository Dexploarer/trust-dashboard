"use client";

import { ContributorData, TIERS, TrustStats, getTierConfig, isAutoMergeEligible } from "@/lib/trust-scoring";
import { formatRelativeTime } from "@/lib/utils";

interface StatsBarProps {
  contributors: ContributorData[];
  stats: TrustStats;
  generatedAt: string;
}

export function StatsBar({ contributors, stats, generatedAt }: StatsBarProps) {
  const totalContributors = stats.totalContributors || contributors.length;
  const avgScore = stats.avgScore || 0;
  const autoMergeCount = contributors.filter(isAutoMergeEligible).length;
  const totalCoauthoredCommits = stats.totalCoauthoredCommits ?? 0;
  const totalCoauthorPairs = stats.totalCoauthorPairs ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <StatCard label="Total Contributors" value={totalContributors.toString()} />
        <StatCard label="Average Score" value={avgScore.toFixed(1)} />
        <StatCard label="Auto-Merge Eligible" value={autoMergeCount.toString()} />
        <StatCard label="Total Events" value={stats.totalEvents.toString()} />
        <StatCard label="Co-Auth Commits" value={totalCoauthoredCommits.toString()} />
        <StatCard label="Co-Auth Partners" value={totalCoauthorPairs.toString()} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-semibold">Tier Distribution</h3>
          <p className="text-xs text-muted-foreground">Last updated: {formatRelativeTime(generatedAt)}</p>
        </div>

        <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
          {TIERS.map((tier) => {
            const count = stats.tierDistribution[tier.label] || 0;
            const pct = totalContributors > 0 ? (count / totalContributors) * 100 : 0;
            if (pct <= 0) return null;

            return (
              <div
                key={tier.label}
                className="h-full"
                style={{ width: `${pct}%`, backgroundColor: tier.color }}
                title={`${tier.label}: ${count} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2 text-xs">
          {TIERS.map((tier) => {
            const count = stats.tierDistribution[tier.label] || 0;
            if (count === 0) return null;
            const cfg = getTierConfig(tier.label);

            return (
              <div key={tier.label} className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className="capitalize">{tier.label}</span>
                <span className="font-mono">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold font-mono mt-1">{value}</div>
    </div>
  );
}
