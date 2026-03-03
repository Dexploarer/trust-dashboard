import { CHARACTER_CLASSES, type CharacterClass } from "@/lib/levels";

interface CharacterClassBadgeProps {
  characterClass: CharacterClass;
  size?: "sm" | "md";
}

export function CharacterClassBadge({ characterClass, size = "md" }: CharacterClassBadgeProps) {
  const info = CHARACTER_CLASSES[characterClass] ?? CHARACTER_CLASSES.anon;

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border border-border bg-muted/80 text-muted-foreground font-medium ${sizeClasses[size]}`}
      title={info.description}
    >
      <span>{info.icon}</span>
      <span>{info.name}</span>
    </span>
  );
}
