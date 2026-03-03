interface VelocityGaugeProps {
  weeklyCount: number;
  softCap?: number;
  hardCap?: number;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angle = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function VelocityGauge({ weeklyCount, softCap = 10, hardCap = 25 }: VelocityGaugeProps) {
  const maxDisplay = Math.max(hardCap + 10, weeklyCount);
  const ratio = Math.min(1, weeklyCount / maxDisplay);
  const needleAngle = 180 * ratio;
  const needle = polarToCartesian(50, 50, 33, needleAngle);

  const softEnd = (softCap / maxDisplay) * 180;
  const hardEnd = (hardCap / maxDisplay) * 180;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <h3 className="text-lg font-semibold mb-3">Weekly Velocity</h3>
      <svg viewBox="0 0 100 60" className="h-40 w-full" role="img" aria-label="Weekly velocity gauge">
        <path d={describeArc(50, 50, 34, 0, softEnd)} stroke="#10B981" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d={describeArc(50, 50, 34, softEnd, hardEnd)} stroke="#F59E0B" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d={describeArc(50, 50, 34, hardEnd, 180)} stroke="#EF4444" strokeWidth="8" fill="none" strokeLinecap="round" />

        <line x1="50" y1="50" x2={needle.x} y2={needle.y} stroke="currentColor" strokeWidth="1.6" />
        <circle cx="50" cy="50" r="2" fill="currentColor" />
      </svg>

      <div className="text-center font-mono text-xl font-bold">{weeklyCount} PRs</div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span>Soft cap {softCap}</span>
        <span>Hard cap {hardCap}</span>
      </div>
    </section>
  );
}
