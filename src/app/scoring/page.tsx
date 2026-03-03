"use client";

import { useMemo, useState } from "react";
import { TIERS } from "@/lib/trust-scoring";
import { TierBadge } from "@/components/tier-badge";
import { BADGE_DEFINITIONS, BADGE_TIER_COLORS } from "@/lib/badges";
import { ALL_TAGS, CHARACTER_CLASSES } from "@/lib/levels";

const DIM_WIDTH = 680;
const DIM_HEIGHT = 220;
const PAD_X = 48;
const PAD_Y = 20;

function diminishingMultiplier(x: number): number {
  return 1 / (1 + 0.2 * Math.log(1 + x));
}

function recencyWeight(days: number): number {
  return 0.5 ** (days / 45);
}

function ScoringCard({ title, formula, description }: { title: string; formula: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 card-hover">
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <code className="text-xs text-accent bg-muted px-2 py-1 rounded block mb-2 font-mono">{formula}</code>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function DiminishingCurve() {
  const [prior, setPrior] = useState(10);

  const points = useMemo(() => {
    return Array.from({ length: 51 }, (_, x) => {
      const y = diminishingMultiplier(x);
      const px = PAD_X + (x / 50) * (DIM_WIDTH - PAD_X * 2);
      const py = PAD_Y + (1 - y) * (DIM_HEIGHT - PAD_Y * 2);
      return { x, y, px, py };
    });
  }, []);

  const path = points.map((p, idx) => `${idx === 0 ? "M" : "L"}${p.px},${p.py}`).join(" ");
  const selected = points[Math.max(0, Math.min(50, prior))];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <h4 className="font-semibold">Diminishing Returns Curve</h4>
      <p className="text-xs text-muted-foreground">multiplier = 1 / (1 + 0.2 x ln(1 + priorApprovals))</p>

      <svg
        viewBox={`0 0 ${DIM_WIDTH} ${DIM_HEIGHT}`}
        className="w-full"
        onMouseMove={(e) => {
          const bounds = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - bounds.left - PAD_X) / (bounds.width - PAD_X * 2)));
          setPrior(Math.round(ratio * 50));
        }}
      >
        <line x1={PAD_X} y1={DIM_HEIGHT - PAD_Y} x2={DIM_WIDTH - PAD_X} y2={DIM_HEIGHT - PAD_Y} stroke="currentColor" opacity="0.35" />
        <line x1={PAD_X} y1={PAD_Y} x2={PAD_X} y2={DIM_HEIGHT - PAD_Y} stroke="currentColor" opacity="0.35" />
        <path d={path} fill="none" stroke="#C084FC" strokeWidth="3" />
        <circle cx={selected.px} cy={selected.py} r="5" fill="#A855F7" />
        <text x={selected.px + 10} y={selected.py - 8} fill="currentColor" fontSize="11">
          {selected.x} approvals &rarr; {(selected.y * 100).toFixed(1)}%
        </text>
        <text x={PAD_X} y={DIM_HEIGHT - 4} fill="currentColor" fontSize="11">0</text>
        <text x={DIM_WIDTH - PAD_X - 16} y={DIM_HEIGHT - 4} fill="currentColor" fontSize="11">50</text>
        <text x={PAD_X - 28} y={PAD_Y + 10} fill="currentColor" fontSize="11">1.0</text>
        <text x={PAD_X - 28} y={DIM_HEIGHT - PAD_Y} fill="currentColor" fontSize="11">0</text>
      </svg>

      <div className="grid gap-2 text-xs sm:grid-cols-3 text-muted-foreground">
        <p>Your 1st approval: 100%</p>
        <p>Your 10th: 68%</p>
        <p>Your 50th: 56%</p>
      </div>
    </div>
  );
}

function RecencyCurve() {
  const points = useMemo(() => {
    return Array.from({ length: 181 }, (_, days) => {
      const y = recencyWeight(days);
      const px = PAD_X + (days / 180) * (DIM_WIDTH - PAD_X * 2);
      const py = PAD_Y + (1 - y) * (DIM_HEIGHT - PAD_Y * 2);
      return { days, y, px, py };
    });
  }, []);

  const path = points.map((p, idx) => `${idx === 0 ? "M" : "L"}${p.px},${p.py}`).join(" ");

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <h4 className="font-semibold">Recency Decay Curve</h4>
      <p className="text-xs text-muted-foreground">weight = 0.5 ^ (daysSinceEvent / 45)</p>
      <svg viewBox={`0 0 ${DIM_WIDTH} ${DIM_HEIGHT}`} className="w-full">
        <line x1={PAD_X} y1={DIM_HEIGHT - PAD_Y} x2={DIM_WIDTH - PAD_X} y2={DIM_HEIGHT - PAD_Y} stroke="currentColor" opacity="0.35" />
        <line x1={PAD_X} y1={PAD_Y} x2={PAD_X} y2={DIM_HEIGHT - PAD_Y} stroke="currentColor" opacity="0.35" />
        <path d={path} fill="none" stroke="#06B6D4" strokeWidth="3" />

        {[45, 90, 135].map((marker) => {
          const x = PAD_X + (marker / 180) * (DIM_WIDTH - PAD_X * 2);
          const y = PAD_Y + (1 - recencyWeight(marker)) * (DIM_HEIGHT - PAD_Y * 2);
          return (
            <g key={marker}>
              <line x1={x} y1={PAD_Y} x2={x} y2={DIM_HEIGHT - PAD_Y} stroke="#94A3B8" strokeDasharray="4 4" opacity="0.65" />
              <circle cx={x} cy={y} r="4" fill="#06B6D4" />
              <text x={x - 14} y={PAD_Y + 12} fill="currentColor" fontSize="11">{marker}d</text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-muted-foreground">Half-life checkpoints: 45d &rarr; 50%, 90d &rarr; 25%, 135d &rarr; 12.5%</p>
    </div>
  );
}

function ComplexityBars() {
  const buckets = [
    { label: "trivial ≤10", multiplier: 0.4 },
    { label: "small ≤50", multiplier: 0.7 },
    { label: "medium ≤150", multiplier: 1.0 },
    { label: "large ≤500", multiplier: 1.3, sweetSpot: true },
    { label: "xlarge ≤1500", multiplier: 1.5 },
    { label: "massive >1500", multiplier: 1.2 },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <h4 className="font-semibold">Complexity Buckets</h4>
      <svg viewBox="0 0 700 220" className="w-full">
        <line x1="50" y1="190" x2="670" y2="190" stroke="currentColor" opacity="0.35" />
        {buckets.map((bucket, idx) => {
          const width = 86;
          const gap = 16;
          const x = 56 + idx * (width + gap);
          const height = bucket.multiplier / 1.6 * 140;
          const y = 190 - height;
          return (
            <g key={bucket.label}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx="6"
                fill={bucket.sweetSpot ? "#A855F7" : "#334155"}
                opacity={bucket.sweetSpot ? 0.85 : 0.8}
              />
              <text x={x + 22} y={205} fill="currentColor" fontSize="10">{bucket.label.split(" ")[0]}</text>
              <text x={x + 20} y={y - 6} fill="currentColor" fontSize="10">{bucket.multiplier.toFixed(1)}x</text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-muted-foreground">Sweet spot highlighted: 150-500 LOC (large bucket) balances impact and reviewability.</p>
    </div>
  );
}

export default function ScoringPage() {
  const badgeTiers = ["acolyte", "priestess", "remilia"] as const;
  const classEntries = Object.values(CHARACTER_CLASSES);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">Trust Scoring Algorithm</h2>
        <p className="text-sm text-muted-foreground">
          How contributor trust scores are computed for milady-ai/milaidy. Score range: 0-100. Starting score: 35 (probationary).
        </p>
      </div>

      {/* Trust Tiers */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Trust Tiers</h3>
        <div className="space-y-2">
          {TIERS.map((tier) => (
            <div key={tier.label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 card-hover">
              <TierBadge tier={tier} size="md" />
              <span className="font-mono text-sm text-muted-foreground">{tier.minScore}+</span>
              <span className="text-sm text-muted-foreground flex-1">{tier.description}</span>
              {tier.autoMerge && (
                <span className="text-xs text-tier-legendary border border-tier-legendary/30 rounded-full px-2 py-0.5">
                  auto-merge
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Badge System */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Badge System</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Earn badges by reaching milestones. Each badge has 3 tiers: Acolyte, Priestess, and Remilia.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGE_DEFINITIONS.map((badge) => (
            <div key={badge.type} className="rounded-2xl border border-border bg-card p-4 card-hover">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{badge.icon}</span>
                <span className="font-medium text-sm">{badge.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{badge.description}</p>
              <div className="flex gap-2">
                {badgeTiers.map((tier) => {
                  const colors = BADGE_TIER_COLORS[tier];
                  return (
                    <span
                      key={tier}
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs capitalize"
                      style={{ backgroundColor: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}
                    >
                      {tier}: {badge.thresholds[tier]}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* XP & Level System */}
      <section>
        <h3 className="text-lg font-semibold mb-3">XP & Level System</h3>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-1">RuneScape XP Formula</h4>
            <code className="text-xs text-accent bg-muted px-2 py-1 rounded block font-mono">
              Level n requires: floor(1/4 * sum(i=1..n-1: floor(i + 150 * 2^(i/10))))
            </code>
            <p className="text-sm text-muted-foreground mt-2">
              Each tag tracks XP independently. Your total level is the sum of all tag levels. Max level per tag: 99.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 px-2 py-1 text-xs"
                >
                  <span>{tag.icon}</span>
                  <span>{tag.name}</span>
                  <span className="text-muted-foreground capitalize">({tag.category})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Character Classes */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Character Classes</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Your class is determined by your highest-XP tag. Agents are always classified as Machine.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {classEntries.map((cls) => (
            <div key={cls.id} className="rounded-2xl border border-border bg-card p-3 card-hover">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{cls.icon}</span>
                <span className="font-medium text-sm">{cls.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{cls.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 8 Scoring Components */}
      <section>
        <h3 className="text-lg font-semibold mb-3">8 Scoring Components</h3>
        <div className="grid gap-3">
          <ScoringCard
            title="1. Diminishing Returns"
            formula="multiplier = 1 / (1 + 0.2 x ln(1 + priorApprovals))"
            description="Each subsequent approval is worth less. Your 50th approval earns ~56% of your 1st. Prevents grinding."
          />
          <ScoringCard
            title="2. Recency Weighting"
            formula="weight = 0.5 ^ (daysSinceEvent / 45)"
            description="Events lose relevance over time with a 45-day half-life. After 90 days, an event has 25% weight."
          />
          <ScoringCard
            title="3. Complexity Buckets"
            formula="trivial(≤10 LOC): 0.4x -> medium(≤150): 1.0x -> xlarge(≤1500): 1.5x -> massive(>1500): 1.2x"
            description="Bigger PRs earn more, but suspiciously large PRs get capped. Sweet spot: 150-500 LOC."
          />
          <ScoringCard
            title="4. Category Weights"
            formula="security: 1.8x -> core: 1.3x -> feature: 1.1x -> docs: 0.6x -> chore: 0.5x"
            description="High-impact categories earn more trust. Security fixes are worth 3.6x a chore PR."
          />
          <ScoringCard
            title="5. Streak Mechanics"
            formula="approvals: +8%/streak (max +50%) | rejections: +15%/streak penalty (max 2.5x)"
            description="Consecutive approvals compound a bonus. Consecutive rejections compound a penalty."
          />
          <ScoringCard
            title="6. Inactivity Decay"
            formula="After 10 days: -0.5%/day toward floor of 30"
            description="Trust decays if you stop contributing. 10-day grace period. Score trends toward 40, floor at 30."
          />
          <ScoringCard
            title="7. Velocity Gates"
            formula="Soft cap: 10 PRs/week (-15%/excess) | Hard cap: 25 PRs/week (zeroed)"
            description="Too many PRs too fast is suspicious. Points are reduced or zeroed above thresholds."
          />
          <ScoringCard
            title="8. Daily Point Cap"
            formula="Max 35 raw positive points per calendar day"
            description="Prevents trust explosions from a single day of activity. Encourages sustained contributions."
          />
        </div>
      </section>

      {/* Visualizations */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Mechanism Visualizations</h3>
        <DiminishingCurve />
        <RecencyCurve />
        <ComplexityBars />
      </section>

      {/* Event Types */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Event Types</h3>
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-left">
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Base Points</th>
                <th className="px-4 py-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-2 font-mono text-tier-trusted">approve</td>
                <td className="px-4 py-2 font-mono">+12</td>
                <td className="px-4 py-2 text-muted-foreground">PR approved and merged</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-tier-probationary">reject</td>
                <td className="px-4 py-2 font-mono">-6</td>
                <td className="px-4 py-2 text-muted-foreground">PR received CHANGES_REQUESTED</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-tier-restricted">close</td>
                <td className="px-4 py-2 font-mono">-10</td>
                <td className="px-4 py-2 text-muted-foreground">PR closed without merge</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-muted-foreground">selfClose</td>
                <td className="px-4 py-2 font-mono">-2</td>
                <td className="px-4 py-2 text-muted-foreground">Contributor closed own PR</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-accent">review</td>
                <td className="px-4 py-2 font-mono">+3 XP</td>
                <td className="px-4 py-2 text-muted-foreground">PR review submitted (XP only, no trust points)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-accent">issue</td>
                <td className="px-4 py-2 font-mono">+5 XP</td>
                <td className="px-4 py-2 text-muted-foreground">Issue created or closed (XP only)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-accent">comment</td>
                <td className="px-4 py-2 font-mono">+1 XP</td>
                <td className="px-4 py-2 text-muted-foreground">Issue or PR comment (XP only)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
