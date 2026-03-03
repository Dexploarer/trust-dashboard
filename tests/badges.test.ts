import { describe, test, expect } from "bun:test";
import { computeBadges, isBadgeEarned, type BadgeInput } from "../src/lib/badges";

function makeInput(overrides: Partial<BadgeInput> = {}): BadgeInput {
  return { mergedPRs: 0, bugsClosed: 0, reviewsGiven: 0, longestStreak: 0, totalLevel: 0, ...overrides };
}

describe("computeBadges", () => {
  test("returns 5 badges for zero input", () => {
    const badges = computeBadges(makeInput());
    expect(badges).toHaveLength(5);
  });

  test("no badges earned at zero values", () => {
    const badges = computeBadges(makeInput());
    const earned = badges.filter(isBadgeEarned);
    expect(earned).toHaveLength(0);
  });

  test("earns acolyte schizo-shipper at 5 merged PRs", () => {
    const badges = computeBadges(makeInput({ mergedPRs: 5 }));
    const shipper = badges.find((b) => b.type === "schizo-shipper")!;
    expect(isBadgeEarned(shipper)).toBe(true);
    expect(shipper.tier).toBe("acolyte");
  });

  test("earns priestess schizo-shipper at 25 merged PRs", () => {
    const badges = computeBadges(makeInput({ mergedPRs: 25 }));
    const shipper = badges.find((b) => b.type === "schizo-shipper")!;
    expect(isBadgeEarned(shipper)).toBe(true);
    expect(shipper.tier).toBe("priestess");
  });

  test("earns remilia schizo-shipper at 100 merged PRs", () => {
    const badges = computeBadges(makeInput({ mergedPRs: 100 }));
    const shipper = badges.find((b) => b.type === "schizo-shipper")!;
    expect(isBadgeEarned(shipper)).toBe(true);
    expect(shipper.tier).toBe("remilia");
    expect(shipper.progress).toBe(1);
    expect(shipper.nextThreshold).toBeNull();
  });

  test("does not earn schizo-shipper below threshold", () => {
    const badges = computeBadges(makeInput({ mergedPRs: 4 }));
    const shipper = badges.find((b) => b.type === "schizo-shipper")!;
    expect(isBadgeEarned(shipper)).toBe(false);
    expect(shipper.progress).toBeCloseTo(4 / 5, 2);
  });

  test("earns oracle at 10 reviews", () => {
    const badges = computeBadges(makeInput({ reviewsGiven: 10 }));
    const oracle = badges.find((b) => b.type === "oracle")!;
    expect(isBadgeEarned(oracle)).toBe(true);
    expect(oracle.tier).toBe("acolyte");
  });

  test("earns streak-demon at 7 days", () => {
    const badges = computeBadges(makeInput({ longestStreak: 7 }));
    const streak = badges.find((b) => b.type === "streak-demon")!;
    expect(isBadgeEarned(streak)).toBe(true);
    expect(streak.tier).toBe("acolyte");
  });

  test("earns bug-priestess priestess at 15 bugs", () => {
    const badges = computeBadges(makeInput({ bugsClosed: 15 }));
    const bug = badges.find((b) => b.type === "bug-priestess")!;
    expect(isBadgeEarned(bug)).toBe(true);
    expect(bug.tier).toBe("priestess");
  });

  test("earns ascended at totalLevel 10", () => {
    const badges = computeBadges(makeInput({ totalLevel: 10 }));
    const ascended = badges.find((b) => b.type === "ascended")!;
    expect(isBadgeEarned(ascended)).toBe(true);
    expect(ascended.tier).toBe("acolyte");
  });

  test("multiple badges can be earned simultaneously", () => {
    const badges = computeBadges(makeInput({
      mergedPRs: 100,
      bugsClosed: 50,
      reviewsGiven: 200,
      longestStreak: 60,
      totalLevel: 50,
    }));
    const earned = badges.filter(isBadgeEarned);
    expect(earned).toHaveLength(5);
    expect(earned.every((b) => b.tier === "remilia")).toBe(true);
  });
});

describe("isBadgeEarned", () => {
  test("returns false for zero-value badge", () => {
    const badges = computeBadges(makeInput());
    expect(badges.every((b) => !isBadgeEarned(b))).toBe(true);
  });

  test("returns true at exact threshold", () => {
    const badges = computeBadges(makeInput({ mergedPRs: 5 }));
    const shipper = badges.find((b) => b.type === "schizo-shipper")!;
    expect(isBadgeEarned(shipper)).toBe(true);
  });
});
