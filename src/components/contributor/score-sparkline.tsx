"use client";

import { useMemo, useState } from "react";
import { ScoreHistoryPoint } from "@/lib/contributor-types";
import { TIERS, getTierForScore } from "@/lib/trust-scoring";

interface ScoreSparklineProps {
  history: ScoreHistoryPoint[];
}

const CHART_WIDTH = 100;
const CHART_HEIGHT = 48;

function normalizeTimestamp(ts: number): number {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

export function ScoreSparkline({ history }: ScoreSparklineProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length === 0) return [];

    const minX = normalizeTimestamp(sorted[0].timestamp);
    const maxX = normalizeTimestamp(sorted[sorted.length - 1].timestamp);
    const xRange = Math.max(1, maxX - minX);

    return sorted.map((point, idx) => {
      const xVal = normalizeTimestamp(point.timestamp);
      const x = ((xVal - minX) / xRange) * CHART_WIDTH;
      const y = CHART_HEIGHT - (Math.max(0, Math.min(100, point.score)) / 100) * CHART_HEIGHT;
      return { ...point, index: idx, x, y, xVal };
    });
  }, [history]);

  if (points.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <h3 className="text-lg font-semibold mb-2">Score Trend</h3>
        <p className="text-sm text-muted-foreground">No score history available yet.</p>
      </section>
    );
  }

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : points[points.length - 1];
  const polyline = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const currentTier = getTierForScore(points[points.length - 1].score);
  const currentTierIdx = TIERS.findIndex((tier) => tier.label === currentTier.label);
  const nextTierMin = currentTierIdx > 0 ? TIERS[currentTierIdx - 1].minScore : 100;
  const currentTierYMax = CHART_HEIGHT - (currentTier.minScore / 100) * CHART_HEIGHT;
  const currentTierYMin = CHART_HEIGHT - (nextTierMin / 100) * CHART_HEIGHT;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Score Trend</h3>
        <div className="text-xs text-muted-foreground font-mono">
          {new Date(normalizeTimestamp(hoverPoint.timestamp)).toLocaleDateString()} · {hoverPoint.score.toFixed(1)}
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-44 w-full"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH;
            let nearest = 0;
            let minDist = Number.POSITIVE_INFINITY;

            points.forEach((point, idx) => {
              const distance = Math.abs(point.x - x);
              if (distance < minDist) {
                minDist = distance;
                nearest = idx;
              }
            });

            setHoverIndex(nearest);
          }}
          onMouseLeave={() => setHoverIndex(null)}
          role="img"
          aria-label="Trust score trend over time"
        >
          <rect
            x="0"
            y={Math.min(currentTierYMin, currentTierYMax)}
            width={CHART_WIDTH}
            height={Math.abs(currentTierYMax - currentTierYMin)}
            fill={`${currentTier.color}1A`}
          />

          {TIERS.map((tier) => {
            const y = CHART_HEIGHT - (tier.minScore / 100) * CHART_HEIGHT;
            return (
              <line key={tier.label} x1="0" x2={CHART_WIDTH} y1={y} y2={y} stroke="rgba(148,163,184,0.24)" strokeWidth="0.35" />
            );
          })}

          <polyline fill="none" stroke={currentTier.color} strokeWidth="1.6" points={polyline} />

          {hoverPoint && (
            <>
              <line x1={hoverPoint.x} x2={hoverPoint.x} y1="0" y2={CHART_HEIGHT} stroke="rgba(192,132,252,0.45)" strokeWidth="0.5" />
              <circle cx={hoverPoint.x} cy={hoverPoint.y} r="1.4" fill={currentTier.color} />
            </>
          )}
        </svg>
      </div>
    </section>
  );
}
