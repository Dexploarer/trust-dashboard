import { ScoreBreakdown } from "@/lib/contributor-types";

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdown;
}

interface StepRow {
  label: string;
  value: number;
  change: number;
  detail: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fmtSigned(value: number, digits = 2): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

export function ScoreBreakdownViz({ breakdown }: ScoreBreakdownProps) {
  const afterDiminishing = breakdown.rawPoints * breakdown.diminishingFactor;
  const afterRecency = breakdown.recencyWeightedPoints;
  const afterStreak = afterRecency * breakdown.streakMultiplier;
  const velocityMultiplier = Math.max(0, 1 - breakdown.velocityPenalty);
  const afterVelocity = afterStreak * velocityMultiplier;
  const dailyCapLoss = breakdown.eventDetails.reduce((sum, event) => sum + (event.cappedBy ?? 0), 0);
  const afterInactivity = afterVelocity - breakdown.inactivityDecay;
  const afterDailyCap = afterInactivity - dailyCapLoss;
  const afterManual = afterDailyCap + breakdown.manualAdjustment;

  const rows: StepRow[] = [
    {
      label: "Base points earned",
      value: breakdown.rawPoints,
      change: breakdown.rawPoints,
      detail: "Raw points before anti-gaming modifiers",
    },
    {
      label: "After diminishing returns",
      value: afterDiminishing,
      change: afterDiminishing - breakdown.rawPoints,
      detail: `${((1 - breakdown.diminishingFactor) * 100).toFixed(1)}% reduction`,
    },
    {
      label: "After recency weighting",
      value: afterRecency,
      change: afterRecency - afterDiminishing,
      detail: "Recent contributions weighted higher",
    },
    {
      label: "Streak bonus / penalty",
      value: afterStreak,
      change: afterStreak - afterRecency,
      detail: `${fmtSigned((breakdown.streakMultiplier - 1) * 100, 1)}% streak impact`,
    },
    {
      label: "Velocity gate",
      value: afterVelocity,
      change: afterVelocity - afterStreak,
      detail: breakdown.velocityPenalty > 0
        ? `${(breakdown.velocityPenalty * 100).toFixed(1)}% penalty for high throughput`
        : "No weekly velocity penalty",
    },
    {
      label: "Inactivity decay",
      value: afterInactivity,
      change: -breakdown.inactivityDecay,
      detail: breakdown.inactivityDecay > 0
        ? `-${breakdown.inactivityDecay.toFixed(2)} points from inactivity`
        : "No inactivity decay",
    },
    {
      label: "Daily cap",
      value: afterDailyCap,
      change: -dailyCapLoss,
      detail: dailyCapLoss > 0 ? `-${dailyCapLoss.toFixed(2)} points capped` : "No daily cap applied",
    },
    {
      label: "Manual adjustment",
      value: afterManual,
      change: breakdown.manualAdjustment,
      detail: breakdown.manualAdjustment === 0 ? "No manual adjustment" : "Maintainer adjustment",
    },
  ];

  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.change)));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <h3 className="text-lg font-semibold mb-4">Score Breakdown</h3>
      <div className="space-y-3">
        {rows.map((row) => {
          const width = clamp((Math.abs(row.change) / maxAbs) * 100, 4, 100);
          const isPositive = row.change >= 0;

          return (
            <div key={row.label} className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="text-sm font-medium">{row.label}</div>
                <div className="font-mono text-sm" style={{ color: isPositive ? "#10B981" : "#EF4444" }}>
                  {fmtSigned(row.change)}
                </div>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">{row.detail}</div>
              <div className="mt-2 text-xs text-muted-foreground font-mono">Current: {row.value.toFixed(2)}</div>

              <svg viewBox="0 0 100 8" className="mt-2 h-2 w-full" preserveAspectRatio="none" aria-hidden>
                <rect x="0" y="0" width="100" height="8" fill="rgba(148,163,184,0.15)" rx="4" />
                <rect
                  x="0"
                  y="0"
                  width={width}
                  height="8"
                  fill={isPositive ? "#10B981" : "#EF4444"}
                  rx="4"
                  opacity="0.85"
                />
              </svg>
            </div>
          );
        })}
      </div>
    </section>
  );
}
