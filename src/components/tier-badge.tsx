import { TierConfig, TrustTier, getTierConfig } from "@/lib/trust-scoring";

interface TierBadgeProps {
  tier: TierConfig | TrustTier;
  size?: "sm" | "md" | "lg";
}

export function TierBadge({ tier, size = "md" }: TierBadgeProps) {
  const tierConfig = typeof tier === "string" ? getTierConfig(tier) : tier;

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
    lg: "text-sm px-3 py-1.5 gap-2",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${tierConfig.color} 11%, var(--color-card))`,
        color: tierConfig.color,
        borderColor: `color-mix(in srgb, ${tierConfig.color} 22%, var(--color-border))`,
      }}
    >
      <span>{tierConfig.icon}</span>
      <span className="capitalize">{tierConfig.label}</span>
    </span>
  );
}
