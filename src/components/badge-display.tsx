import { type EarnedBadge, BADGE_TIER_COLORS, isBadgeEarned } from "@/lib/badges";

interface BadgeDisplayProps {
  badges: EarnedBadge[];
  compact?: boolean;
}

export function BadgeDisplay({ badges, compact = false }: BadgeDisplayProps) {
  const earned = badges.filter(isBadgeEarned);
  const locked = badges.filter((b) => !isBadgeEarned(b));

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {earned.map((badge) => {
          const colors = BADGE_TIER_COLORS[badge.tier];
          return (
            <span
              key={badge.type}
              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px]"
              style={{ backgroundColor: `${colors.bg}`, color: colors.color, border: `1px solid ${colors.border}` }}
              title={`${badge.name} (${badge.tier})`}
            >
              {badge.icon}
            </span>
          );
        })}
        {earned.length === 0 && <span className="text-[11px] text-muted-foreground">No badges</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {earned.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {earned.map((badge) => (
            <BadgeCard key={badge.type} badge={badge} earned />
          ))}
        </div>
      )}
      {locked.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {locked.map((badge) => (
            <BadgeCard key={badge.type} badge={badge} earned={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function BadgeCard({ badge, earned }: { badge: EarnedBadge; earned: boolean }) {
  const colors = BADGE_TIER_COLORS[badge.tier];

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        earned
          ? "bg-card border-border"
          : "border-dashed border-border/70 bg-muted/35 opacity-75"
      }`}
      style={earned ? { boxShadow: "inset 2px 0 0 0 " + colors.color } : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{badge.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{badge.name}</div>
          <div className="text-xs text-muted-foreground capitalize">
            {earned ? badge.tier : `${badge.currentValue}/${badge.nextThreshold}`}
          </div>
        </div>
        {!earned && (
          <span className="text-xs text-muted-foreground">🔒</span>
        )}
      </div>
      {!earned && badge.nextThreshold && (
        <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-muted-foreground/40"
            style={{ width: `${badge.progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
