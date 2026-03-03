import { describe, test, expect } from "bun:test";
import {
  xpToLevel,
  computeLevelStats,
  computeTagXp,
  determineCharacterClass,
  isAgent,
  CHARACTER_CLASSES,
} from "../src/lib/levels";

describe("xpToLevel", () => {
  test("0 XP is level 1", () => {
    const result = xpToLevel(0);
    expect(result.level).toBe(1);
    expect(result.progress).toBe(0);
  });

  test("very high XP reaches max level 99", () => {
    const result = xpToLevel(999_999_999);
    expect(result.level).toBe(99);
    expect(result.progress).toBe(1);
    expect(result.pointsToNext).toBe(0);
  });

  test("small positive XP is still level 1 with progress", () => {
    const result = xpToLevel(10);
    expect(result.level).toBe(1);
    expect(result.progress).toBeGreaterThan(0);
    expect(result.pointsToNext).toBeGreaterThan(0);
  });

  test("level increases with more XP", () => {
    const low = xpToLevel(100);
    const high = xpToLevel(10000);
    expect(high.level).toBeGreaterThan(low.level);
  });

  test("progress is between 0 and 1", () => {
    for (const xp of [0, 50, 200, 1000, 5000]) {
      const result = xpToLevel(xp);
      expect(result.progress).toBeGreaterThanOrEqual(0);
      expect(result.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe("computeTagXp", () => {
  test("empty events produce empty XP", () => {
    const xp = computeTagXp([]);
    expect(Object.keys(xp)).toHaveLength(0);
  });

  test("matches known tag IDs", () => {
    const xp = computeTagXp([{ labels: ["core", "feature"], weight: 10 }]);
    expect(xp["core"]).toBe(10);
    expect(xp["feature"]).toBe(10);
  });

  test("ignores unknown labels", () => {
    const xp = computeTagXp([{ labels: ["unknown-label"], weight: 10 }]);
    expect(Object.keys(xp)).toHaveLength(0);
  });

  test("accumulates XP across multiple events", () => {
    const xp = computeTagXp([
      { labels: ["core"], weight: 10 },
      { labels: ["core"], weight: 5 },
    ]);
    expect(xp["core"]).toBe(15);
  });

  test("normalizes label casing and spaces", () => {
    const xp = computeTagXp([{ labels: ["Critical-Fix"], weight: 10 }]);
    expect(xp["critical-fix"]).toBe(10);
  });
});

describe("computeLevelStats", () => {
  test("empty XP returns zero totals", () => {
    const stats = computeLevelStats({});
    expect(stats.totalLevel).toBe(0);
    expect(stats.totalXp).toBe(0);
    expect(stats.tags).toHaveLength(0);
  });

  test("sums levels across tags", () => {
    const stats = computeLevelStats({ core: 100, ui: 100 });
    expect(stats.totalLevel).toBeGreaterThanOrEqual(2);
    expect(stats.totalXp).toBe(200);
    expect(stats.tags).toHaveLength(2);
  });

  test("tags are sorted by XP descending", () => {
    const stats = computeLevelStats({ core: 50, ui: 200, docs: 100 });
    expect(stats.tags[0].tagId).toBe("ui");
    expect(stats.tags[1].tagId).toBe("docs");
    expect(stats.tags[2].tagId).toBe("core");
  });

  test("skips tags with zero XP", () => {
    const stats = computeLevelStats({ core: 100, ui: 0 });
    expect(stats.tags).toHaveLength(1);
    expect(stats.tags[0].tagId).toBe("core");
  });
});

describe("isAgent", () => {
  test("detects [bot] suffix", () => {
    expect(isAgent("dependabot[bot]")).toBe(true);
    expect(isAgent("renovate[bot]")).toBe(true);
  });

  test("detects -bot in name", () => {
    expect(isAgent("my-bot")).toBe(true);
    expect(isAgent("some-bot-helper")).toBe(true);
  });

  test("detects known agents", () => {
    expect(isAgent("dependabot")).toBe(true);
    expect(isAgent("renovate")).toBe(true);
    expect(isAgent("github-actions")).toBe(true);
    expect(isAgent("codecov")).toBe(true);
  });

  test("returns false for normal usernames", () => {
    expect(isAgent("alice")).toBe(false);
    expect(isAgent("bob123")).toBe(false);
    expect(isAgent("HomunculusLabs")).toBe(false);
  });

  test("is case-insensitive", () => {
    expect(isAgent("Dependabot[BOT]")).toBe(true);
    expect(isAgent("MY-BOT")).toBe(true);
  });
});

describe("determineCharacterClass", () => {
  test("returns machine for agents", () => {
    const cls = determineCharacterClass({ core: 100 }, true);
    expect(cls.id).toBe("machine");
  });

  test("returns anon for empty XP", () => {
    const cls = determineCharacterClass({}, false);
    expect(cls.id).toBe("anon");
  });

  test("returns core-dev for core-dominant", () => {
    const cls = determineCharacterClass({ core: 100, ui: 10 }, false);
    expect(cls.id).toBe("core-dev");
  });

  test("returns designer for ui-dominant", () => {
    const cls = determineCharacterClass({ ui: 100, core: 10 }, false);
    expect(cls.id).toBe("designer");
  });

  test("returns scribe for docs-dominant", () => {
    const cls = determineCharacterClass({ docs: 100 }, false);
    expect(cls.id).toBe("scribe");
  });

  test("returns guardian for security-dominant", () => {
    const cls = determineCharacterClass({ security: 100 }, false);
    expect(cls.id).toBe("guardian");
  });

  test("returns infra for ci-dominant", () => {
    const cls = determineCharacterClass({ ci: 100 }, false);
    expect(cls.id).toBe("infra");
  });

  test("returns connector for connector-dominant", () => {
    const cls = determineCharacterClass({ connector: 100 }, false);
    expect(cls.id).toBe("connector");
  });

  test("all character classes have required fields", () => {
    for (const cls of Object.values(CHARACTER_CLASSES)) {
      expect(cls.id).toBeDefined();
      expect(cls.name).toBeDefined();
      expect(cls.icon).toBeDefined();
      expect(cls.description).toBeDefined();
    }
  });
});
