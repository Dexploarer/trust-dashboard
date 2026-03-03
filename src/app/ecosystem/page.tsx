"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveEcosystemData } from "@/lib/use-live-ecosystem-data";
import { withBasePath } from "@/lib/base-path";
import { formatRelativeTime } from "@/lib/utils";

type Mode = "milady" | "eliza" | "effect";

const MODE_LABELS: Record<Mode, string> = {
  milady: "Milady",
  eliza: "Eliza",
  effect: "Eliza Effect",
};

export default function EcosystemPage() {
  const [mode, setMode] = useState<Mode>("effect");
  const [intersectionOnly, setIntersectionOnly] = useState(true);

  const {
    crossContributors,
    trackedRepos,
    generatedAt,
    isLoading,
    isRefreshing,
    refreshError,
    nextRefreshIn,
    lastUpdatedAt,
  } = useLiveEcosystemData();

  const rows = useMemo(() => {
    const filtered = crossContributors.filter((contributor) => {
      if (!contributor.eliza) return false;
      if (!intersectionOnly) return true;
      return Boolean(contributor.milady);
    });

    const sorted = [...filtered].sort((a, b) => {
      if (mode === "milady") {
        const aScore = a.milady?.trustScore ?? -1;
        const bScore = b.milady?.trustScore ?? -1;
        return bScore - aScore || a.username.localeCompare(b.username);
      }

      if (mode === "eliza") {
        const aRank = a.eliza?.lifetimeRank ?? Number.MAX_SAFE_INTEGER;
        const bRank = b.eliza?.lifetimeRank ?? Number.MAX_SAFE_INTEGER;
        return aRank - bRank || a.username.localeCompare(b.username);
      }

      const aScore = a.elizaEffect?.effectScore ?? -1;
      const bScore = b.elizaEffect?.effectScore ?? -1;
      return bScore - aScore || a.username.localeCompare(b.username);
    });

    return sorted;
  }, [crossContributors, intersectionOnly, mode]);

  const coverage = useMemo(() => {
    const included = trackedRepos.filter((repo) => repo.includeInEcosystemFactor);
    if (included.length === 0) return 0;
    const available = included.filter((repo) => repo.summaryStatus === "ok").length;
    return available / included.length;
  }, [trackedRepos]);

  const statusLabel = isLoading
    ? "Loading ecosystem rankings..."
    : isRefreshing
      ? "Refreshing ecosystem rankings..."
      : `Live ecosystem · refresh ${nextRefreshIn}s`;
  const apiIndexUrl = withBasePath("/api/index.json");

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <header className="space-y-3 text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          {statusLabel}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Milady + Eliza Ecosystem</h1>
        <p className="text-sm text-muted-foreground">
          Compare Milady trust with Eliza lifetime signals and a composite Eliza Effect score.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Rows" value={rows.length.toLocaleString()} />
        <MetricCard label="Tracked Repos" value={trackedRepos.length.toLocaleString()} />
        <MetricCard label="Repo Coverage" value={`${(coverage * 100).toFixed(0)}%`} />
        <MetricCard label="Updated" value={formatRelativeTime(lastUpdatedAt)} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(MODE_LABELS) as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === value
                  ? "border-violet-300 bg-violet-50 text-violet-700"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {MODE_LABELS[value]}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIntersectionOnly((value) => !value)}
            className={`ml-auto rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              intersectionOnly
                ? "border-violet-300 bg-violet-50 text-violet-700"
                : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {intersectionOnly ? "Intersection only" : "Full Eliza"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{rows.length.toLocaleString()} contributors</span>
          <span>•</span>
          <span>Generated {formatRelativeTime(generatedAt)}</span>
          <span>•</span>
          <a
            href={apiIndexUrl}
            className="underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            API index
          </a>
        </div>
      </section>

      {refreshError ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Live refresh failed: {refreshError}. Showing the latest bundled snapshot.
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Contributor</th>
                <th className="px-3 py-2 text-right">Milady Score</th>
                <th className="px-3 py-2 text-right">Eliza Lifetime</th>
                <th className="px-3 py-2 text-right">Eliza Rank</th>
                <th className="px-3 py-2 text-right">Eliza Effect</th>
                <th className="px-3 py-2 text-right">Ecosystem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((contributor, index) => {
                const miladyScore = contributor.milady?.trustScore;
                const elizaScore = contributor.eliza?.lifetimeScore;
                const elizaRank = contributor.eliza?.lifetimeRank;
                const effectScore = contributor.elizaEffect?.effectScore;
                const ecosystem = contributor.elizaEffect?.ecosystemNorm ?? 0;

                return (
                  <tr key={`${contributor.username}-${index}`} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      <Link href={`/contributor/${contributor.username}`} className="flex items-center gap-2 hover:underline">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={contributor.avatarUrl || `https://github.com/${contributor.username}.png`}
                          alt={contributor.username}
                          className="h-7 w-7 rounded-full border border-border bg-muted"
                          loading="lazy"
                        />
                        <span className="max-w-[180px] truncate font-medium">@{contributor.username}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{miladyScore != null ? miladyScore.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{elizaScore != null ? elizaScore.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{elizaRank != null ? `#${elizaRank}` : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: mode === "effect" ? "var(--color-accent)" : undefined }}>
                      {effectScore != null ? effectScore.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{(ecosystem * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No contributors available for this view.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Tracked Repositories</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {trackedRepos.map((repo) => (
            <div key={repo.repoId} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{repo.label}</span>
                <span className="font-mono uppercase">{repo.summaryStatus}</span>
              </div>
              <div className="mt-1 text-muted-foreground">
                {repo.owner}/{repo.repo}
              </div>
            </div>
          ))}
        </div>
      </section>
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
