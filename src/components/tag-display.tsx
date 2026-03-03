import type { TagScore } from "@/lib/levels";
import { ALL_TAGS } from "@/lib/levels";

interface TagDisplayProps {
  tags: TagScore[];
  compact?: boolean;
}

export function TagDisplay({ tags, compact = false }: TagDisplayProps) {
  if (tags.length === 0) {
    return <span className="text-xs text-muted-foreground">No tags</span>;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, 5).map((tag) => {
          const def = ALL_TAGS.find((t) => t.id === tag.tagId);
          return (
            <span
              key={tag.tagId}
              className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[11px]"
              title={`${def?.name ?? tag.tagId} · Level ${tag.level} · ${tag.xp} XP`}
            >
              <span>{def?.icon ?? "📦"}</span>
              <span className="font-mono text-muted-foreground">Lv{tag.level}</span>
            </span>
          );
        })}
        {tags.length > 5 && (
          <span className="text-xs text-muted-foreground">+{tags.length - 5}</span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {tags.map((tag) => {
        const def = ALL_TAGS.find((t) => t.id === tag.tagId);
        return (
          <div key={tag.tagId} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{def?.icon ?? "📦"}</span>
                <span className="text-sm font-medium">{def?.name ?? tag.tagId}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono font-bold">Lv {tag.level}</span>
                <span className="text-xs text-muted-foreground ml-1">({tag.xp.toLocaleString()} XP)</span>
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${tag.progress * 100}%` }}
              />
            </div>
            {tag.pointsToNext > 0 && (
              <div className="mt-1 text-xs text-muted-foreground text-right">
                {tag.pointsToNext.toLocaleString()} XP to next level
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
