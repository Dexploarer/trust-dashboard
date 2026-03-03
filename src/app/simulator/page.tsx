"use client";

import { useMemo, useState } from "react";
import { TierBadge } from "@/components/tier-badge";
import {
  DEFAULT_CONFIG,
  computeTrustScore,
  type EventBreakdown,
  type EventType,
  type ReviewSeverity,
  type TrustEvent,
} from "@/lib/scoring-engine";

const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_KEYS = [
  "security",
  "critical-fix",
  "core",
  "feature",
  "bugfix",
  "refactor",
  "test",
  "docs",
  "chore",
  "aesthetic",
] as const;

type CategoryKey = (typeof CATEGORY_KEYS)[number];

type SimEvent = {
  id: string;
  prNumber: number;
  type: EventType;
  daysAgo: number;
  linesChanged: number;
  labels: CategoryKey[];
  reviewSeverity: ReviewSeverity;
};

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function formatSigned(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(1)}`;
}

function numberInputValue(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function eventTypeLabel(type: EventType): string {
  switch (type) {
    case "approve":
      return "approve (merged)";
    case "reject":
      return "reject (changes requested)";
    case "close":
      return "close (not merged)";
    case "selfClose":
      return "self close (author)";
    default:
      return type;
  }
}

function severityLabel(sev: ReviewSeverity): string {
  switch (sev) {
    case "critical":
      return "critical";
    case "major":
      return "major";
    case "normal":
      return "normal";
    case "minor":
      return "minor";
    case "trivial":
      return "trivial";
    default:
      return sev;
  }
}

export default function SimulatorPage() {
  const [now, setNow] = useState(() => Date.now());
  const [manualAdjustment, setManualAdjustment] = useState<number>(0);

  const [events, setEvents] = useState<SimEvent[]>(() => [
    {
      id: newId(),
      prNumber: 1,
      type: "approve",
      daysAgo: 1,
      linesChanged: 220,
      labels: ["core"],
      reviewSeverity: "normal",
    },
    {
      id: newId(),
      prNumber: 2,
      type: "approve",
      daysAgo: 3,
      linesChanged: 80,
      labels: ["feature"],
      reviewSeverity: "normal",
    },
    {
      id: newId(),
      prNumber: 3,
      type: "reject",
      daysAgo: 7,
      linesChanged: 0,
      labels: ["security"],
      reviewSeverity: "major",
    },
    {
      id: newId(),
      prNumber: 4,
      type: "approve",
      daysAgo: 12,
      linesChanged: 40,
      labels: ["docs"],
      reviewSeverity: "normal",
    },
  ]);

  const engineEvents = useMemo<TrustEvent[]>(() => {
    const sorted = [...events].sort((a, b) => b.daysAgo - a.daysAgo || a.prNumber - b.prNumber);
    return sorted.map((ev, idx) => {
      const timestamp = now - ev.daysAgo * DAY_MS + idx * 60_000;
      return {
        prNumber: ev.prNumber,
        type: ev.type,
        timestamp,
        linesChanged: ev.type === "approve" ? ev.linesChanged : 0,
        labels: ev.labels,
        reviewSeverity: ev.type === "reject" ? ev.reviewSeverity : undefined,
      };
    });
  }, [events, now]);

  const scoreResult = useMemo(() => {
    return computeTrustScore(
      {
        contributor: "simulator",
        createdAt: now,
        events: engineEvents,
        manualAdjustment,
      },
      DEFAULT_CONFIG,
      now,
    );
  }, [engineEvents, manualAdjustment, now]);

  const detailByPr = useMemo(() => {
    const map = new Map<number, EventBreakdown>();
    for (const detail of scoreResult.breakdown.eventDetails) {
      map.set(detail.prNumber, detail);
    }
    return map;
  }, [scoreResult.breakdown.eventDetails]);

  const weeklyCount = useMemo(() => {
    const windowMs = DEFAULT_CONFIG.velocity.windowDays * DAY_MS;
    return engineEvents.filter((ev) => now - ev.timestamp <= windowMs).length;
  }, [engineEvents, now]);

  const delta = scoreResult.score - DEFAULT_CONFIG.initialScore;

  function addEvent() {
    setEvents((prev) => {
      const nextPr = prev.reduce((max, ev) => Math.max(max, ev.prNumber), 0) + 1;
      return [
        ...prev,
        {
          id: newId(),
          prNumber: nextPr,
          type: "approve",
          daysAgo: 0,
          linesChanged: 150,
          labels: [],
          reviewSeverity: DEFAULT_CONFIG.defaultReviewSeverity,
        },
      ];
    });
  }

  function removeEvent(id: string) {
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  }

  function updateEvent(id: string, patch: Partial<SimEvent>) {
    setEvents((prev) => prev.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev)));
  }

  function toggleLabel(id: string, label: CategoryKey) {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== id) return ev;
        const next = ev.labels.includes(label)
          ? ev.labels.filter((l) => l !== label)
          : [...ev.labels, label];
        return { ...ev, labels: next };
      }),
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold">Trust Score Simulator</h2>
        <p className="text-sm text-muted-foreground">
          Build a hypothetical PR history and compute a trust score using the same engine as the leaderboard.
        </p>
      </header>

      {/* Score overview */}
      <section className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Final score</div>
            <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-2">
              <div className="text-4xl font-bold font-mono">{scoreResult.score.toFixed(1)}</div>
              <TierBadge tier={scoreResult.tier} size="md" />
              <div className="text-xs text-muted-foreground font-mono">
                start {DEFAULT_CONFIG.initialScore.toFixed(0)} · delta {formatSigned(delta)}
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              now: {new Date(now).toLocaleString()} · score range {DEFAULT_CONFIG.minScore}-{DEFAULT_CONFIG.maxScore}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Manual adjust</span>
              <input
                className="w-24 bg-transparent font-mono outline-none"
                type="number"
                step="0.1"
                value={numberInputValue(manualAdjustment)}
                onChange={(e) => setManualAdjustment(Number(e.target.value))}
              />
            </label>

            <button
              type="button"
              className="rounded-lg border border-border bg-muted px-3 py-2 text-sm hover:bg-muted/80 transition-colors"
              onClick={() => setNow(Date.now())}
            >
              Refresh now
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Weekly velocity"
            value={`${weeklyCount}/${DEFAULT_CONFIG.velocity.softCapPRs}`}
            sub={`soft cap (${DEFAULT_CONFIG.velocity.windowDays}d)`}
          />
          <Stat
            label="Velocity penalty"
            value={`${(scoreResult.breakdown.velocityPenalty * 100).toFixed(1)}%`}
            sub={scoreResult.breakdown.velocityPenalty > 0 ? "applies to positives" : "none"}
          />
          <Stat
            label="Inactivity decay"
            value={scoreResult.breakdown.inactivityDecay.toFixed(2)}
            sub="applied after last event"
          />
          <Stat
            label="Manual adjustment"
            value={scoreResult.breakdown.manualAdjustment.toFixed(2)}
            sub="maintainer override"
          />
        </div>

        {scoreResult.warnings.length > 0 && (
          <div className="rounded-lg border border-border bg-muted p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Warnings</div>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              {scoreResult.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Events */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Events</h3>
          <button
            type="button"
            className="rounded-xl border border-violet-300 bg-violet-50 text-violet-700 px-3 py-2 text-sm hover:bg-violet-100 transition-colors"
            onClick={addEvent}
          >
            + Add event
          </button>
        </div>

        <div className="grid gap-3">
          {events
            .slice()
            .sort((a, b) => a.daysAgo - b.daysAgo || a.prNumber - b.prNumber)
            .map((ev) => {
              const detail = detailByPr.get(ev.prNumber);
              const finalPoints = detail?.finalPoints ?? 0;
              const cappedBy = detail?.cappedBy;

              return (
                <div key={ev.id} className="rounded-2xl border border-border bg-card p-4 space-y-4 card-hover">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-muted-foreground">PR #{ev.prNumber}</span>
                      <span className="text-sm">{eventTypeLabel(ev.type)}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-sm ${finalPoints >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                        title="Final points (after caps)"
                      >
                        {formatSigned(finalPoints)}
                      </span>
                      {typeof cappedBy === "number" && cappedBy > 0 && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          capped -{cappedBy.toFixed(2)}
                        </span>
                      )}
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        onClick={() => removeEvent(ev.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Type</div>
                      <select
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none"
                        value={ev.type}
                        onChange={(e) => {
                          const nextType = e.target.value as EventType;
                          updateEvent(ev.id, {
                            type: nextType,
                            linesChanged: nextType === "approve" ? ev.linesChanged : 0,
                            reviewSeverity: nextType === "reject" ? ev.reviewSeverity : DEFAULT_CONFIG.defaultReviewSeverity,
                          });
                        }}
                      >
                        <option value="approve">approve</option>
                        <option value="reject">reject</option>
                        <option value="close">close</option>
                        <option value="selfClose">selfClose</option>
                      </select>
                    </label>

                    <label className="space-y-1">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Days ago</div>
                      <input
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono outline-none"
                        type="number"
                        min={0}
                        step={1}
                        value={numberInputValue(ev.daysAgo)}
                        onChange={(e) =>
                          updateEvent(ev.id, { daysAgo: clampNumber(Number(e.target.value), 0, 3650) })
                        }
                      />
                    </label>

                    <label className="space-y-1">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Lines changed</div>
                      <input
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono outline-none disabled:opacity-40"
                        type="number"
                        min={0}
                        step={1}
                        disabled={ev.type !== "approve"}
                        value={numberInputValue(ev.linesChanged)}
                        onChange={(e) =>
                          updateEvent(ev.id, { linesChanged: clampNumber(Number(e.target.value), 0, 50_000) })
                        }
                      />
                    </label>

                    <label className="space-y-1">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Reject severity</div>
                      <select
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none disabled:opacity-40"
                        disabled={ev.type !== "reject"}
                        value={ev.reviewSeverity}
                        onChange={(e) => updateEvent(ev.id, { reviewSeverity: e.target.value as ReviewSeverity })}
                      >
                        {(["critical", "major", "normal", "minor", "trivial"] as ReviewSeverity[]).map((sev) => (
                          <option key={sev} value={sev}>
                            {severityLabel(sev)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Category labels (max weight wins)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_KEYS.map((label) => {
                        const selected = ev.labels.includes(label);
                        const weight = DEFAULT_CONFIG.categoryWeights[label] ?? DEFAULT_CONFIG.defaultCategoryWeight;

                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => toggleLabel(ev.id, label)}
                            className={`rounded-full border px-2 py-1 text-xs font-mono transition-colors ${
                              selected
                                ? "border-accent/40 bg-accent/20 text-accent"
                                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                            title={`${weight.toFixed(1)}x`}
                          >
                            {label} {weight.toFixed(1)}x
                          </button>
                        );
                      })}
                      {ev.labels.length === 0 && (
                        <span className="text-xs text-muted-foreground px-1 py-1">
                          none selected &rarr; default {DEFAULT_CONFIG.defaultCategoryWeight.toFixed(1)}x
                        </span>
                      )}
                    </div>
                  </div>

                  {detail && (
                    <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2 lg:grid-cols-4">
                      <MiniStat label="diminishing" value={`x${detail.diminishingMultiplier.toFixed(2)}`} />
                      <MiniStat label="recency" value={`x${detail.recencyWeight.toFixed(2)}`} />
                      <MiniStat label="streak" value={`x${detail.streakMultiplier.toFixed(2)}`} />
                      <MiniStat label="weighted" value={detail.weightedPoints.toFixed(2)} />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      {/* Breakdown table */}
      <details className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <summary className="cursor-pointer select-none text-sm font-medium">View per-event breakdown</summary>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-xs text-muted-foreground uppercase tracking-wide">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 text-left">PR</th>
                <th className="py-2 pr-3 text-left">Type</th>
                <th className="py-2 pr-3 text-right">base</th>
                <th className="py-2 pr-3 text-right">dim</th>
                <th className="py-2 pr-3 text-right">recency</th>
                <th className="py-2 pr-3 text-right">complex</th>
                <th className="py-2 pr-3 text-right">category</th>
                <th className="py-2 pr-3 text-right">streak</th>
                <th className="py-2 pr-3 text-right">severity</th>
                <th className="py-2 pr-3 text-right">weighted</th>
                <th className="py-2 pr-3 text-right">final</th>
              </tr>
            </thead>
            <tbody>
              {scoreResult.breakdown.eventDetails.map((d) => (
                <tr key={d.prNumber} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono text-muted-foreground">#{d.prNumber}</td>
                  <td className="py-2 pr-3">{d.type}</td>
                  <td className="py-2 pr-3 text-right font-mono">{d.basePoints.toFixed(0)}</td>
                  <td className="py-2 pr-3 text-right font-mono">x{d.diminishingMultiplier.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right font-mono">x{d.recencyWeight.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right font-mono">x{d.complexityMultiplier.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right font-mono">x{d.categoryMultiplier.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right font-mono">x{d.streakMultiplier.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right font-mono">x{d.severityMultiplier.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{d.weightedPoints.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{d.finalPoints.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted px-3 py-2 flex items-center justify-between gap-2">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
