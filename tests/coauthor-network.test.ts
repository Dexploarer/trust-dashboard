import { describe, test, expect } from "bun:test";
import {
  buildCoAuthorStats,
  deriveLoginFromEmail,
  normalizeCoAuthorStats,
  extractCoAuthorsFromCommitMessage,
  isLikelyGitHubUsername,
} from "../src/lib/coauthor-network";

describe("isLikelyGitHubUsername", () => {
  test("accepts valid usernames", () => {
    expect(isLikelyGitHubUsername("HomunculusLabs")).toBe(true);
    expect(isLikelyGitHubUsername("user-name")).toBe(true);
    expect(isLikelyGitHubUsername("a")).toBe(true);
  });

  test("rejects invalid usernames", () => {
    expect(isLikelyGitHubUsername("bad name")).toBe(false);
    expect(isLikelyGitHubUsername("trailing-")).toBe(false);
    expect(isLikelyGitHubUsername("x".repeat(40))).toBe(false);
    expect(isLikelyGitHubUsername("noreply")).toBe(false);
  });
});

describe("deriveLoginFromEmail", () => {
  test("parses github noreply email", () => {
    expect(deriveLoginFromEmail("123456+Dexploarer@users.noreply.github.com")).toBe("dexploarer");
  });

  test("parses simple local-part login", () => {
    expect(deriveLoginFromEmail("HomunculusLabs@example.com")).toBe("homunculuslabs");
  });

  test("returns null for non-username local parts", () => {
    expect(deriveLoginFromEmail("first.last@example.com")).toBeNull();
    expect(deriveLoginFromEmail("noreply@users.noreply.github.com")).toBeNull();
  });
});

describe("extractCoAuthorsFromCommitMessage", () => {
  test("extracts co-authored-by footers", () => {
    const message = `feat: add leaderboard\n\nCo-authored-by: Alice <alice@example.com>\nCo-authored-by: Bob <123+bob@users.noreply.github.com>`;
    const result = extractCoAuthorsFromCommitMessage(message);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("Alice");
    expect(result[1]?.name).toBe("Bob");
  });

  test("dedupes duplicate lines", () => {
    const message = `Co-authored-by: Alice <alice@example.com>\nCo-authored-by: Alice <alice@example.com>`;
    const result = extractCoAuthorsFromCommitMessage(message);
    expect(result).toHaveLength(1);
  });
});

describe("buildCoAuthorStats", () => {
  test("builds uses and usedBy links with counts", () => {
    const stats = buildCoAuthorStats(
      [
        { primary: "agent-one", partners: ["alice", "bob"] },
        { primary: "agent-one", partners: ["alice"] },
        { primary: "alice", partners: ["agent-one"] },
      ],
      (username) => username.includes("agent"),
    );

    const agent = stats.get("agent-one");
    const alice = stats.get("alice");
    const bob = stats.get("bob");

    expect(agent?.totalCoauthoredCommits).toBe(3);
    expect(agent?.totalCoauthorPartners).toBe(2);
    expect(agent?.uses[0]?.username).toBe("alice");
    expect(agent?.uses[0]?.count).toBe(2);
    expect(agent?.usedBy[0]?.username).toBe("alice");

    expect(alice?.totalCoauthoredCommits).toBe(3);
    expect(alice?.usedBy[0]?.username).toBe("agent-one");
    expect(alice?.usedBy[0]?.count).toBe(2);

    expect(bob?.totalCoauthoredCommits).toBe(1);
    expect(bob?.usedBy[0]?.username).toBe("agent-one");
  });
});

describe("normalizeCoAuthorStats", () => {
  test("filters reserved usernames and recalculates partner count", () => {
    const normalized = normalizeCoAuthorStats(
      {
        totalCoauthoredCommits: 4,
        totalCoauthorPartners: 2,
        uses: [
          { username: "noreply", count: 3, isAgent: false },
          { username: "alice", count: 1, isAgent: false },
        ],
        usedBy: [
          { username: "no-reply", count: 2, isAgent: false },
          { username: "agent-one", count: 1, isAgent: true },
        ],
      },
      (username) => username.includes("agent"),
    );

    expect(normalized.uses).toHaveLength(1);
    expect(normalized.uses[0]?.username).toBe("alice");
    expect(normalized.usedBy).toHaveLength(1);
    expect(normalized.usedBy[0]?.username).toBe("agent-one");
    expect(normalized.totalCoauthorPartners).toBe(2);
    expect(normalized.totalCoauthoredCommits).toBe(4);
  });
});
