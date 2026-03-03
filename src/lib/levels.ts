/**
 * XP / Level / Character Class system for Milaidy Trust Dashboard.
 * Levels use the RuneScape formula. Tags map to milaidy repo labels.
 */

export type TagCategory = "area" | "category";

export interface TagDefinition {
  id: string;
  name: string;
  category: TagCategory;
  icon: string;
}

// Area tags from milaidy labeler.yml
export const AREA_TAGS: TagDefinition[] = [
  { id: "core", name: "Core", category: "area", icon: "⚙️" },
  { id: "ui", name: "UI", category: "area", icon: "🎨" },
  { id: "connector", name: "Connector", category: "area", icon: "🔌" },
  { id: "plugins", name: "Plugins", category: "area", icon: "🧩" },
  { id: "electron", name: "Electron", category: "area", icon: "⚡" },
  { id: "docs", name: "Docs", category: "area", icon: "📝" },
  { id: "tests", name: "Tests", category: "area", icon: "🧪" },
  { id: "ci", name: "CI", category: "area", icon: "🔄" },
  { id: "build", name: "Build", category: "area", icon: "🏗️" },
  { id: "deploy", name: "Deploy", category: "area", icon: "🚀" },
];

// Category tags from scoring engine weights
export const CATEGORY_TAGS: TagDefinition[] = [
  { id: "security", name: "Security", category: "category", icon: "🛡️" },
  { id: "critical-fix", name: "Critical Fix", category: "category", icon: "🚨" },
  { id: "feature", name: "Feature", category: "category", icon: "✨" },
  { id: "bugfix", name: "Bugfix", category: "category", icon: "🐛" },
  { id: "refactor", name: "Refactor", category: "category", icon: "♻️" },
  { id: "chore", name: "Chore", category: "category", icon: "🧹" },
  { id: "aesthetic", name: "Aesthetic", category: "category", icon: "💅" },
];

export const ALL_TAGS: TagDefinition[] = [...AREA_TAGS, ...CATEGORY_TAGS];

export interface TagScore {
  tagId: string;
  xp: number;
  level: number;
  progress: number; // 0-1 toward next level
  pointsToNext: number;
}

export interface LevelStats {
  totalLevel: number;
  totalXp: number;
  tags: TagScore[];
}

export type CharacterClass =
  | "core-dev"
  | "connector"
  | "designer"
  | "scribe"
  | "guardian"
  | "infra"
  | "machine"
  | "anon";

export interface CharacterClassInfo {
  id: CharacterClass;
  name: string;
  icon: string;
  description: string;
}

export const CHARACTER_CLASSES: Record<CharacterClass, CharacterClassInfo> = {
  "core-dev": { id: "core-dev", name: "Core Dev", icon: "⚙️", description: "Primary contributor to core and plugin systems" },
  connector: { id: "connector", name: "Connector", icon: "🔌", description: "Specializes in connector and electron integrations" },
  designer: { id: "designer", name: "Designer", icon: "🎨", description: "UI and aesthetic focus" },
  scribe: { id: "scribe", name: "Scribe", icon: "📝", description: "Documentation specialist" },
  guardian: { id: "guardian", name: "Guardian", icon: "🛡️", description: "Security, testing, and critical fixes" },
  infra: { id: "infra", name: "Infra", icon: "🏗️", description: "CI/CD, build, and deployment" },
  machine: { id: "machine", name: "Machine", icon: "🤖", description: "Automated agent contributor" },
  anon: { id: "anon", name: "Anon", icon: "👤", description: "General contributor" },
};

// RuneScape XP-to-level formula
// Level n requires: floor(1/4 * sum(i=1..n-1: floor(i + 150 * 2^(i/10))))
const MAX_LEVEL = 99;
const XP_TABLE: number[] = [];

function buildXpTable() {
  let totalXp = 0;
  XP_TABLE.push(0); // Level 1 = 0 XP
  for (let level = 1; level < MAX_LEVEL; level++) {
    totalXp += Math.floor(level + 150 * 2 ** (level / 10));
    XP_TABLE.push(Math.floor(totalXp / 4));
  }
}
buildXpTable();

export function xpToLevel(xp: number): { level: number; progress: number; pointsToNext: number } {
  let level = 1;
  for (let i = 1; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) {
      level = i + 1;
    } else {
      break;
    }
  }

  if (level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, progress: 1, pointsToNext: 0 };
  }

  const currentLevelXp = XP_TABLE[level - 1];
  const nextLevelXp = XP_TABLE[level];
  const progress = (xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp);
  const pointsToNext = nextLevelXp - xp;

  return { level, progress: Math.min(1, Math.max(0, progress)), pointsToNext };
}

export function computeLevelStats(tagXp: Record<string, number>): LevelStats {
  let totalLevel = 0;
  let totalXp = 0;
  const tags: TagScore[] = [];

  for (const tagDef of ALL_TAGS) {
    const xp = tagXp[tagDef.id] ?? 0;
    if (xp <= 0) continue;
    const { level, progress, pointsToNext } = xpToLevel(xp);
    totalLevel += level;
    totalXp += xp;
    tags.push({ tagId: tagDef.id, xp, level, progress, pointsToNext });
  }

  // Sort by XP descending
  tags.sort((a, b) => b.xp - a.xp);

  return { totalLevel, totalXp, tags };
}

/**
 * Compute XP from PR/issue labels.
 * Each label match adds base XP (scaled by event weight).
 */
export function computeTagXp(events: Array<{ labels: string[]; weight: number }>): Record<string, number> {
  const xp: Record<string, number> = {};

  for (const event of events) {
    const normalizedLabels = event.labels.map((l) => l.toLowerCase().replace(/\s+/g, "-"));

    for (const tagDef of ALL_TAGS) {
      if (normalizedLabels.includes(tagDef.id)) {
        xp[tagDef.id] = (xp[tagDef.id] ?? 0) + event.weight;
      }
    }
  }

  return xp;
}

/**
 * Determine character class from dominant tag XP.
 */
export function determineCharacterClass(
  tagXp: Record<string, number>,
  isAgent: boolean,
): CharacterClassInfo {
  if (isAgent) return CHARACTER_CLASSES.machine;

  const tagEntries = Object.entries(tagXp).sort((a, b) => b[1] - a[1]);
  if (tagEntries.length === 0) return CHARACTER_CLASSES.anon;

  const [topTag] = tagEntries[0];

  // Map top tag to character class
  if (topTag === "core" || topTag === "plugins" || topTag === "plugin") return CHARACTER_CLASSES["core-dev"];
  if (topTag === "connector" || topTag === "electron") return CHARACTER_CLASSES.connector;
  if (topTag === "ui" || topTag === "aesthetic") return CHARACTER_CLASSES.designer;
  if (topTag === "docs" || topTag === "documentation") return CHARACTER_CLASSES.scribe;
  if (topTag === "security" || topTag === "critical-fix" || topTag === "tests" || topTag === "test") return CHARACTER_CLASSES.guardian;
  if (topTag === "ci" || topTag === "build" || topTag === "deploy") return CHARACTER_CLASSES.infra;

  return CHARACTER_CLASSES.anon;
}

/**
 * Detect if a GitHub username is an agent/bot.
 */
const KNOWN_AGENTS: string[] = [
  "dependabot",
  "renovate",
  "github-actions",
  "codecov",
];

export function isAgent(username: string): boolean {
  const lower = username.toLowerCase();
  if (lower.endsWith("[bot]") || lower.includes("-bot")) return true;
  if (KNOWN_AGENTS.some((a) => lower.includes(a))) return true;
  return false;
}
