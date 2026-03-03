import Link from "next/link";
import { ContributorData, getApprovalRate } from "@/lib/trust-scoring";

interface LeaderboardProps {
  contributors: ContributorData[];
}

function rankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function normalizeTimestamp(ts: number): number {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

function isRecentlyActive(lastEventAt: string | null): boolean {
  if (!lastEventAt) return false;
  const ts = Date.parse(lastEventAt);
  if (Number.isNaN(ts)) return false;
  const days = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return days <= 30;
}

function eventsThisMonth(contributor: ContributorData): number {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  return contributor.events.filter((event) => {
    const date = new Date(normalizeTimestamp(event.timestamp));
    return date.getUTCFullYear() === currentYear && date.getUTCMonth() === currentMonth;
  }).length;
}

function formatLastActivityDate(lastEventAt: string | null): string {
  if (!lastEventAt) return "—";
  const date = new Date(lastEventAt);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Leaderboard({ contributors }: LeaderboardProps) {
  if (contributors.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No contributors match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contributors.map((contributor, index) => (
        <LeaderboardRow key={contributor.username} contributor={contributor} rank={index + 1} />
      ))}
    </div>
  );
}

function LeaderboardRow({ contributor, rank }: { contributor: ContributorData; rank: number }) {
  const recent = isRecentlyActive(contributor.lastEventAt);
  const monthDelta = eventsThisMonth(contributor);
  const lastActivity = formatLastActivityDate(contributor.lastEventAt);
  const topThree = rank <= 3;
  const totalEvents = contributor.events.length;
  const approvalRate = Math.round(getApprovalRate(contributor));
  const streakLabel = contributor.currentStreak.length > 0
    ? `${contributor.currentStreak.type === "approve" ? "🔥" : "⚠️"} ${contributor.currentStreak.length}`
    : "—";

  return (
    <Link
      href={`/contributor/${contributor.username}`}
      className={`group block rounded-2xl px-4 py-3 card-hover ${
        topThree
          ? "bg-card border border-violet-300/80 shadow-[0_1px_0_rgba(109,40,217,0.08)] dark:border-violet-700/70"
          : "bg-card border border-zinc-200/80 dark:border-zinc-800 hover:border-violet-200/70 dark:hover:border-violet-800/70"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 shrink-0 text-center font-mono text-sm text-muted-foreground">
          {rankLabel(rank)}
        </div>

        <div className="relative shrink-0">
          <div
            className={`h-12 w-12 overflow-hidden rounded-full ring-2 transition-all ${
              topThree
                ? "ring-violet-400 dark:ring-violet-600"
                : "ring-zinc-200 dark:ring-zinc-700 group-hover:ring-violet-400"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://github.com/${contributor.username}.png`}
              alt={contributor.username}
              className="h-12 w-12 object-cover bg-muted"
              loading="lazy"
            />
          </div>
          {recent ? (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-card bg-emerald-400" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{contributor.username}</span>
            {monthDelta > 0 ? (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">+{monthDelta} this month</span>
            ) : null}
            {contributor.isAgent ? (
              <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                bot
              </span>
            ) : null}
            <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground capitalize">
              {contributor.tier.icon} {contributor.tier.label}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{recent ? "Active in last 30 days" : "No activity in last 30 days"}</span>
            <span>•</span>
            <span>Last activity: {lastActivity}</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>Lv {contributor.totalLevel}</span>
            <span>•</span>
            <span>{contributor.totalXp.toLocaleString()} XP</span>
            <span>•</span>
            <span>{approvalRate}% approval</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xl font-semibold font-mono tabular-nums" style={{ color: contributor.tier.color }}>
            {contributor.trustScore.toFixed(1)}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {totalEvents.toLocaleString()} events
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {streakLabel} streak
          </div>
        </div>
      </div>
    </Link>
  );
}
