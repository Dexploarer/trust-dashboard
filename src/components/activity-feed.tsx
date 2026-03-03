"use client";

import { useMemo, useState } from "react";
import { ContributorData, EventType } from "@/lib/trust-scoring";
import { formatRelativeTime } from "@/lib/utils";

interface ActivityFeedProps {
  contributors: ContributorData[];
}

const EVENT_STYLES: Record<EventType, { icon: string; color: string }> = {
  approve: { icon: "✅", color: "text-tier-trusted" },
  reject: { icon: "❌", color: "text-tier-probationary" },
  close: { icon: "⛔", color: "text-tier-restricted" },
  selfClose: { icon: "↩️", color: "text-muted-foreground" },
};

export function ActivityFeed({ contributors }: ActivityFeedProps) {
  const [open, setOpen] = useState(true);

  const events = useMemo(() => {
    return contributors
      .flatMap((contributor) => {
        // Build lookup from breakdown.eventDetails for scored points
        const detailsByPr = new Map<number, number>();
        contributor.breakdown?.eventDetails?.forEach((d) => {
          detailsByPr.set(d.prNumber, d.finalPoints);
        });

        return contributor.events.map((event) => ({
          ...event,
          username: contributor.username,
          avatar: `https://github.com/${contributor.username}.png`,
          finalPoints: detailsByPr.get(event.prNumber) ?? 0,
        }));
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
  }, [contributors]);

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/60 transition-colors"
      >
        <span className="font-semibold text-sm">Recent Activity ({events.length})</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="divide-y divide-border">
          {events.map((event, idx) => {
            const style = EVENT_STYLES[event.type];
            const points = event.pointsEarned ?? event.finalPoints ?? 0;

            return (
              <div key={`${event.username}-${event.id ?? idx}`} className="px-4 py-3 flex items-center gap-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.avatar} alt={event.username} className="h-8 w-8 rounded-full bg-muted" loading="lazy" />
                <span className={`${style.color} text-base`}>{style.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-medium">{event.username}</span>
                    <span className="text-muted-foreground"> · PR #{event.prNumber} · </span>
                    <span className={points >= 0 ? "text-tier-trusted" : "text-tier-restricted"}>
                      {points >= 0 ? "+" : ""}
                      {points.toFixed(1)}
                    </span>
                  </div>
                  {event.prTitle && <div className="text-xs text-muted-foreground truncate">{event.prTitle}</div>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(event.timestamp)}</span>
              </div>
            );
          })}
          {events.length === 0 && <div className="px-4 py-6 text-sm text-muted-foreground">No recent events.</div>}
        </div>
      )}
    </section>
  );
}
