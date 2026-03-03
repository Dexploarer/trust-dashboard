import { TierConfig, TrustTier, TIERS, getTierConfig } from "@/lib/trust-scoring";

interface ScoreBarProps {
  score: number;
  tier: TierConfig | TrustTier;
}

export function ScoreBar({ score, tier }: ScoreBarProps) {
  const tierConfig = typeof tier === "string" ? getTierConfig(tier) : tier;

  const tierIdx = TIERS.findIndex((t) => t.label === tierConfig.label);
  const nextTier = tierIdx > 0 ? TIERS[tierIdx - 1] : null;
  const tierMin = tierConfig.minScore;
  const tierMax = nextTier ? nextTier.minScore : 100;
  const progress = ((score - tierMin) / (tierMax - tierMin)) * 100;

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <span className="text-sm font-mono font-semibold" style={{ color: tierConfig.color }}>
        {score.toFixed(1)}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: `linear-gradient(90deg, ${tierConfig.color}, color-mix(in srgb, ${tierConfig.color} 35%, var(--color-accent)))`,
          }}
        />
      </div>
    </div>
  );
}
