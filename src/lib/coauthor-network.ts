export interface CoAuthorIdentity {
  name: string;
  email: string;
}

export interface CoAuthorSeed {
  primary: string;
  partners: string[];
}

export interface CoAuthorLink {
  username: string;
  count: number;
  isAgent: boolean;
}

export interface CoAuthorStats {
  totalCoauthoredCommits: number;
  totalCoauthorPartners: number;
  uses: CoAuthorLink[];
  usedBy: CoAuthorLink[];
}

const CO_AUTHORED_BY_REGEX = /^co-authored-by:\s*(.+?)\s*<([^>]+)>$/gim;
const RESERVED_USERNAMES = new Set([
  "noreply",
  "no-reply",
  "github",
  "github-actions",
  "actions-user",
]);

export function isLikelyGitHubUsername(input: string): boolean {
  const candidate = input.trim();
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(candidate)) {
    return false;
  }
  return !RESERVED_USERNAMES.has(candidate.toLowerCase());
}

export function deriveLoginFromEmail(email: string): string | null {
  const lower = email.trim().toLowerCase();
  const atIndex = lower.indexOf("@");
  if (atIndex <= 0) return null;

  const local = lower.slice(0, atIndex);
  const domain = lower.slice(atIndex + 1);

  let candidate = local;
  if (domain === "users.noreply.github.com" || domain.endsWith(".noreply.github.com")) {
    const plusIndex = local.lastIndexOf("+");
    if (plusIndex >= 0 && plusIndex + 1 < local.length) {
      candidate = local.slice(plusIndex + 1);
    }
  }

  return isLikelyGitHubUsername(candidate) ? candidate : null;
}

export function extractCoAuthorsFromCommitMessage(message: string): CoAuthorIdentity[] {
  const matches = [...message.matchAll(CO_AUTHORED_BY_REGEX)];
  const dedup = new Map<string, CoAuthorIdentity>();

  for (const match of matches) {
    const name = match[1]?.trim();
    const email = match[2]?.trim().toLowerCase();
    if (!name || !email) continue;
    const key = `${name.toLowerCase()}|${email}`;
    dedup.set(key, { name, email });
  }

  return [...dedup.values()];
}

function sortedLinks(
  input: Map<string, number>,
  isAgent: (username: string) => boolean,
): CoAuthorLink[] {
  return [...input.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([username, count]) => ({ username, count, isAgent: isAgent(username) }));
}

export function emptyCoAuthorStats(): CoAuthorStats {
  return {
    totalCoauthoredCommits: 0,
    totalCoauthorPartners: 0,
    uses: [],
    usedBy: [],
  };
}

function normalizeLinks(
  links: Array<{ username: string; count: number }>,
  isAgent: (username: string) => boolean,
): CoAuthorLink[] {
  const countsByLower = new Map<string, number>();
  const displayByLower = new Map<string, string>();

  for (const link of links) {
    const username = link.username?.trim();
    if (!username || !isLikelyGitHubUsername(username)) continue;
    const count = Math.trunc(link.count ?? 0);
    if (!Number.isFinite(count) || count <= 0) continue;

    const lower = username.toLowerCase();
    if (!displayByLower.has(lower)) {
      displayByLower.set(lower, username);
    }
    countsByLower.set(lower, (countsByLower.get(lower) ?? 0) + count);
  }

  return [...countsByLower.entries()]
    .map(([lower, count]) => ({
      username: displayByLower.get(lower) ?? lower,
      count,
      isAgent: isAgent(displayByLower.get(lower) ?? lower),
    }))
    .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username));
}

export function normalizeCoAuthorStats(
  stats: Partial<CoAuthorStats> | null | undefined,
  isAgent: (username: string) => boolean,
): CoAuthorStats {
  if (!stats) return emptyCoAuthorStats();

  const uses = normalizeLinks(stats.uses ?? [], isAgent);
  const usedBy = normalizeLinks(stats.usedBy ?? [], isAgent);
  const totalFromUses = uses.reduce((sum, entry) => sum + entry.count, 0);
  const totalFromUsedBy = usedBy.reduce((sum, entry) => sum + entry.count, 0);
  const explicitTotal = Math.trunc(stats.totalCoauthoredCommits ?? 0);
  const totalCoauthoredCommits = Math.max(
    0,
    Number.isFinite(explicitTotal) ? explicitTotal : 0,
    totalFromUses,
    totalFromUsedBy,
  );

  const partnerSet = new Set<string>();
  for (const entry of uses) partnerSet.add(entry.username.toLowerCase());
  for (const entry of usedBy) partnerSet.add(entry.username.toLowerCase());

  return {
    totalCoauthoredCommits,
    totalCoauthorPartners: partnerSet.size,
    uses,
    usedBy,
  };
}

export function buildCoAuthorStats(
  seeds: CoAuthorSeed[],
  isAgent: (username: string) => boolean,
): Map<string, CoAuthorStats> {
  type MutableStats = {
    totalCoauthoredCommits: number;
    partners: Set<string>;
    uses: Map<string, number>;
    usedBy: Map<string, number>;
  };

  const mutable = new Map<string, MutableStats>();

  function ensure(username: string): MutableStats {
    const existing = mutable.get(username);
    if (existing) return existing;
    const created: MutableStats = {
      totalCoauthoredCommits: 0,
      partners: new Set<string>(),
      uses: new Map<string, number>(),
      usedBy: new Map<string, number>(),
    };
    mutable.set(username, created);
    return created;
  }

  for (const seed of seeds) {
    const primary = seed.primary.trim();
    if (!primary || !isLikelyGitHubUsername(primary)) continue;

    const partners = [...new Set(seed.partners.map((name) => name.trim()).filter((name) => name && name !== primary))];
    if (partners.length === 0) continue;

    const primaryStats = ensure(primary);
    primaryStats.totalCoauthoredCommits++;

    for (const partner of partners) {
      if (!isLikelyGitHubUsername(partner)) continue;

      primaryStats.partners.add(partner);
      primaryStats.uses.set(partner, (primaryStats.uses.get(partner) ?? 0) + 1);

      const partnerStats = ensure(partner);
      partnerStats.totalCoauthoredCommits++;
      partnerStats.partners.add(primary);
      partnerStats.usedBy.set(primary, (partnerStats.usedBy.get(primary) ?? 0) + 1);
    }
  }

  const finalized = new Map<string, CoAuthorStats>();
  for (const [username, stats] of mutable.entries()) {
    finalized.set(username, normalizeCoAuthorStats({
      totalCoauthoredCommits: stats.totalCoauthoredCommits,
      totalCoauthorPartners: stats.partners.size,
      uses: sortedLinks(stats.uses, isAgent),
      usedBy: sortedLinks(stats.usedBy, isAgent),
    }, isAgent));
  }

  return finalized;
}
