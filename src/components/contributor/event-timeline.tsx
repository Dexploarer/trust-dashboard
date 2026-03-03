"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ContributorEvent, EventDetail } from "@/lib/contributor-types";

interface EventTimelineProps {
  username: string;
  events: ContributorEvent[];
  eventDetails: EventDetail[];
}

const DEFAULT_VISIBLE = 20;

function normalizeTimestamp(ts: number): number {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

function eventColor(type: string): string {
  if (type === "approve") return "#10B981";
  if (type === "reject") return "#F97316";
  if (type === "close") return "#EF4444";
  return "#94A3B8";
}

function prettyEventType(type: string): string {
  if (type === "selfClose") return "self-close";
  return type;
}

export function EventTimeline({ username, events, eventDetails }: EventTimelineProps) {
  const [showAll, setShowAll] = useState(false);

  const detailByPr = useMemo(() => {
    const map = new Map<number, EventDetail>();
    eventDetails.forEach((detail) => map.set(detail.prNumber, detail));
    return map;
  }, [eventDetails]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => normalizeTimestamp(b.timestamp) - normalizeTimestamp(a.timestamp));
  }, [events]);

  const visibleEvents = showAll ? sortedEvents : sortedEvents.slice(0, DEFAULT_VISIBLE);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Event Timeline</h3>
        <div className="text-xs text-muted-foreground">{events.length} total events</div>
      </div>

      <div className="space-y-3">
        {visibleEvents.map((event) => {
          const detail = detailByPr.get(event.prNumber);
          const color = eventColor(event.type);
          const finalPoints = detail?.finalPoints ?? detail?.weightedPoints ?? 0;
          const date = new Date(normalizeTimestamp(event.timestamp));

          return (
            <div key={`${event.prNumber}-${event.timestamp}`} className="grid grid-cols-[14px_1fr] gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="mt-1 h-full w-px bg-border" />
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`https://github.com/milady-ai/milaidy/pull/${event.prNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold hover:underline"
                    >
                      PR #{event.prNumber} on GitHub ↗
                    </Link>
                    <span className="rounded-full border px-2 py-0.5 text-xs font-mono capitalize" style={{ borderColor: `${color}66`, color }}>
                      {prettyEventType(event.type)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{date.toLocaleString()}</div>
                </div>

                <div className="mt-2 text-sm font-mono" style={{ color }}>
                  {finalPoints >= 0 ? "+" : ""}
                  {finalPoints.toFixed(2)} points
                </div>

                {detail ? (
                  <>
                    <div className="mt-2 hidden sm:block text-xs text-muted-foreground font-mono break-all">
                      {detail.basePoints.toFixed(2)} × {detail.diminishingMultiplier.toFixed(2)} × {detail.recencyWeight.toFixed(2)} × {detail.complexityMultiplier.toFixed(2)} × {detail.categoryMultiplier.toFixed(2)} × {detail.streakMultiplier.toFixed(2)} = {detail.finalPoints.toFixed(2)}
                    </div>
                    <div className="mt-2 sm:hidden text-xs text-muted-foreground">
                      {detail.basePoints.toFixed(1)}×{detail.diminishingMultiplier.toFixed(2)}×{detail.recencyWeight.toFixed(2)}… = {detail.finalPoints.toFixed(2)}
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground">No detailed multiplier breakdown for this event.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sortedEvents.length > DEFAULT_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          {showAll ? "Show recent 20" : "Show all events"}
        </button>
      )}

      {events.length === 0 && <p className="text-sm text-muted-foreground">No events yet for @{username}.</p>}
    </section>
  );
}
